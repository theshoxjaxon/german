/**
 * The HTTP layer end to end: the real app (guards, filters, cookies) on an in-memory Postgres,
 * driven with supertest. The queries themselves are covered in src/server.test.ts.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp, jsonBody } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import { setDatabase } from '../src/database/db';
import { SESSION_COOKIE } from '../src/auth/session.service';
import { AuthRepository } from '../src/auth/auth.repository';
import { UsersRepository } from '../src/users/users.repository';
import { floodLimit, securityHeaders } from '../src/common/security';

let app: INestApplication;
let close = async () => {};
let cookie: string; // a signed-in student
let adminCookie: string;

async function signInAs(email: string, role: 'student' | 'admin') {
  const users = app.get(UsersRepository);
  const u = await users.createUser({ email, displayName: email.split('@')[0], passwordHash: '$2b$11$not-a-real-hash', emailVerified: true });
  if (u === 'taken') throw new Error('taken');
  if (role === 'admin') await users.setRole(u.id, 'admin');
  const { token } = await app.get(AuthRepository).createSession(u.id, 60_000);
  return `${SESSION_COOKIE}=${token}`;
}

beforeAll(async () => {
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
  const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = ref.createNestApplication({ bodyParser: false });
  app.use(securityHeaders, floodLimit(), jsonBody());
  configureApp(app);
  await app.init();
  cookie = await signInAs('student@example.com', 'student');
  adminCookie = await signInAs('teacher@example.com', 'admin');
}, 60_000);
afterAll(async () => {
  await app?.close();
  await close();
});

const http = () => request(app.getHttpServer());

describe('the HTTP layer', () => {
  it('answers errors as { error } and never caches', async () => {
    const res = await http().get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Sign in to continue.' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('lets a guest see the course list but not a signed-in page', async () => {
    const state = await http().get('/api/state');
    expect(state.status).toBe(200);
    expect(state.body.me).toBeNull();
    expect(state.body.courses.length).toBeGreaterThan(0);
    expect((await http().get('/api/class')).status).toBe(401);
    expect((await http().get('/api/health')).status).toBe(200);
  });

  it('knows the signed-in person from the session cookie', async () => {
    const res = await http().get('/api/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.me.displayName).toBe('student');
    expect(res.body.me).not.toHaveProperty('email'); // only admins see email addresses
    const state = await http().get('/api/state').set('Cookie', cookie);
    expect(Object.keys(state.body.words).length).toBeGreaterThan(800);
  });

  it('answers a POST with 200 (not Nest’s 201) and an empty handler with { ok: true }', async () => {
    const seen = await http().post('/api/cheers/seen').set('Cookie', cookie).send({});
    expect(seen.status).toBe(200);
    expect(seen.body).toEqual({ ok: true });
    const word = await http().put('/api/words/w-mine').set('Cookie', cookie).send({ term: 'der Test', meaning: 'sinov' });
    expect(word.body).toEqual({ ok: true });
    const own = await http().post('/api/words').set('Cookie', cookie).send({ words: [{ id: 'w-2', term: 'das Haus', meaning: 'uy' }] });
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ ok: true, count: 1 });
  });

  it('validates input with a 400 and the original message', async () => {
    const res = await http().put('/api/words/w-bad').set('Cookie', cookie).send({ term: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('A word needs a term and a meaning.');
    expect((await http().put('/api/words/bad id!').set('Cookie', cookie).send({})).body.error).toBe('Invalid word id.');
  });

  it('blocks another site’s writes but allows its reads', async () => {
    const write = await http().put('/api/prefs').set('Cookie', cookie).set('Origin', 'https://evil.example').send({});
    expect(write.status).toBe(403);
    expect(write.body.error).toBe('Cross-site request blocked.');
    expect((await http().get('/api/me').set('Cookie', cookie).set('Origin', 'https://evil.example')).status).toBe(200);
    // the web app proxies /api, so its own host is trusted through X-Forwarded-Host
    const proxied = await http().put('/api/prefs').set('Cookie', cookie).set('Origin', 'https://app.example').set('X-Forwarded-Host', 'app.example').send({});
    expect(proxied.status).toBe(200);
  });

  it('keeps the admin pages for teachers, and tells a student who they are', async () => {
    const student = await http().get('/api/admin/dashboard').set('Cookie', cookie);
    expect(student.status).toBe(403);
    expect(student.body).toEqual({ error: 'This page is for teachers.', name: 'student' });
    const admin = await http().get('/api/admin/dashboard').set('Cookie', adminCookie);
    expect(admin.status).toBe(200);
    expect(admin.body.admin).toBe(true);
    expect(admin.body.course.id).toBe('german');
    expect((await http().post('/api/admin/courses').set('Cookie', cookie).send({ id: 'x' })).status).toBe(403);
  });

  it('signs out: 303 to /login and the cookie stops working', async () => {
    const out = await http().post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(303);
    expect(out.headers.location).toBe('/login');
    expect((await http().get('/api/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('keeps the cron jobs for Vercel’s secret', async () => {
    expect((await http().get('/api/cron/daily')).status).toBe(401);
    process.env.CRON_SECRET = 'a-long-random-secret';
    try {
      expect((await http().get('/api/cron/study').set('Authorization', 'Bearer a-long-random-secret')).status).toBe(200);
      expect((await http().get('/api/cron/study').set('Authorization', 'Bearer wrong')).status).toBe(401);
    } finally {
      delete process.env.CRON_SECRET;
    }
  });

  it('refuses a sign-in sent from another site, even though login is public', async () => {
    const res = await http().post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@gmail.com', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('sends security headers on every answer', async () => {
    const res = await http().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('floodLimit answers 429 with Retry-After once an address passes its limit', () => {
    const limit = floodLimit(2, 60_000);
    const out: { status?: number; headers: Record<string, string> } = { headers: {} };
    const res = { setHeader: (k: string, v: string) => (out.headers[k] = v), status: (n: number) => ((out.status = n), { json: () => undefined }) };
    let passed = 0;
    for (let i = 0; i < 4; i++) limit({ ip: '203.0.113.9' } as never, res as never, () => passed++);
    expect(passed).toBe(2);
    expect(out.status).toBe(429);
    expect(out.headers['Retry-After']).toBeDefined();
  });
});
