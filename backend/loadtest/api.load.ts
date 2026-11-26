/**
 * How many people can use the API at once? Boots the real app (guards, filters, cookies) on an
 * in-memory Postgres, signs in 200 users, and drives it with autocannon over real HTTP.
 *
 *   npm run loadtest            (CONNECTIONS=100 DURATION=10 to change the crowd)
 *
 * By default the database is PGlite (one in-process Postgres), a pessimistic floor. For a realistic
 * run start a throwaway local Postgres and pass LOAD_DATABASE_URL=postgres://user@localhost:5544/db
 * (see backend/README.md). It refuses any host but localhost.
 */
import { execFile } from 'node:child_process';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp, jsonBody } from '../src/app.setup';
import { SESSION_COOKIE } from '../src/auth/session.service';
import { AuthRepository } from '../src/auth/auth.repository';
import { floodLimit, securityHeaders } from '../src/common/security';
import { setDatabase } from '../src/database/db';
import { UsersRepository } from '../src/users/users.repository';

const CONNECTIONS = Number(process.env.CONNECTIONS) || 100;
const DURATION = Number(process.env.DURATION) || 10;
const USERS = 200;

let app: Awaited<ReturnType<Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>['createNestApplication']>>;
let base = '';
let close = async () => {};
const cookies: string[] = [];

beforeAll(async () => {
  const real = process.env.LOAD_DATABASE_URL;
  if (real) {
    // A real PostgreSQL pool, as in production. The test writes 200 fake users: only ever a throwaway database on this computer.
    if (!/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(real)) throw new Error('LOAD_DATABASE_URL must point at a local throwaway database (localhost).');
    process.env.DATABASE_URL = real;
  } else {
    const { PGlite, types } = await import('@electric-sql/pglite');
    const pg = await PGlite.create({ parsers: { [types.INT8]: Number, [types.NUMERIC]: Number } });
    close = () => pg.close();
    setDatabase({
      async query(text, params) {
        const r = params?.length ? await pg.query(text, params) : ((await pg.exec(text)).at(-1) as { rows: never[]; affectedRows?: number } | undefined);
        const rows = (r?.rows ?? []) as never[];
        return { rows, rowCount: Math.max(r?.affectedRows ?? 0, rows.length) };
      },
    });
  }
  const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = ref.createNestApplication({ bodyParser: false });
  app.set('trust proxy', true);
  app.use(securityHeaders, floodLimit(), jsonBody());
  configureApp(app);
  await app.init();
  await app.listen(0);
  base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;

  const users = app.get(UsersRepository);
  const auth = app.get(AuthRepository);
  for (let i = 0; i < USERS; i++) {
    const u = await users.createUser({ email: `load${i}-${Date.now()}@example.com`, displayName: `Load ${i}`, passwordHash: '$2b$11$not-a-real-hash', emailVerified: true });
    if (u === 'taken') throw new Error('taken');
    cookies.push(`${SESSION_COOKIE}=${(await auth.createSession(u.id, 30 * 24 * 3_600_000)).token}`);
  }
});
afterAll(async () => {
  await app?.close();
  await close();
});

/** The crowd runs in its own process (client.mjs): sharing the server's CPU would measure the test, not the API. */
async function run(title: string, kind: 'health' | 'me' | 'state' | 'login', connections: number) {
  await new Promise((r) => setTimeout(r, 5000)); // let the last crowd's sockets close before the next one arrives
  const out = await new Promise<string>((resolve, reject) => {
    execFile('node', ['loadtest/client.mjs', JSON.stringify({ base, connections, duration: DURATION, kind, cookies })], { maxBuffer: 1 << 20 }, (e, stdout) => (e ? reject(e) : resolve(stdout)));
  });
  const r = JSON.parse(out.trim().split('\n').at(-1)!) as { rps: number; p50: number; p99: number; ok: number; refused: number; failed: number; timeouts: number; why: Record<string, number> };
  console.log(`\n${title}\n  ${connections} people at once for ${DURATION}s: ${Math.round(r.rps)} req/s · median ${r.p50} ms · p99 ${r.p99} ms · ${r.ok} ok, ${r.refused} refused, ${r.failed} failed${r.failed ? ` (${r.timeouts} timed out; ${JSON.stringify(r.why)})` : ''}`);
  return r;
}

it('serves a crowd', async () => {
  const one = await fetch(`${base}/api/state`, { headers: { cookie: cookies[0] } });
  const t0 = performance.now();
  const body = await (await fetch(`${base}/api/state`, { headers: { cookie: cookies[0] } })).text();
  console.log(`\nOne /api/state call alone: ${Math.round(performance.now() - t0)} ms, ${(body.length / 1024).toFixed(0)} KB (status ${one.status})`);

  const health = await run('GET /api/health (the server alone, no login)', 'health', CONNECTIONS);
  const me = await run('GET /api/me (signed in: a session lookup in the database)', 'me', CONNECTIONS);
  const state = await run('GET /api/state (what the app loads when a signed-in person opens it: 6 queries)', 'state', CONNECTIONS);
  // Wrong passwords are the expensive path: every try costs a password check, so fewer people at once.
  const login = await run('POST /api/auth/login (wrong password: every try costs a password check)', 'login', 20);
  expect(health.failed + me.failed + state.failed + login.failed).toBe(0); // nothing crashed or hung
  expect(me.refused + state.refused).toBe(0);
});
