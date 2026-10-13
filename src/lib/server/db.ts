/**
 * Database connection and schema: PostgreSQL (Supabase in production).
 *
 * Set DATABASE_URL to your Supabase connection string (see README → "Supabase"). The tables
 * are created on first start, so there is nothing to run by hand.
 *
 * Speed:
 * - One connection pool per server process, kept on globalThis because Next.js may load this
 *   module more than once (one copy per route bundle, plus hot reloads in dev).
 * - Every query the app runs is served by a primary key or an index below.
 * - A cold start costs one small query: the schema is only (re)built when its version changes.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { seedWords } from '../seed';

export type Row = Record<string, unknown>;

/** The one method the app needs: a statement with $1…$n parameters (or, without parameters, a script). */
export interface Db {
  query<R extends Row = Row>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount: number }>;
}

const SCHEMA_VERSION = '1';

/*
 * Times are milliseconds since 1970 (JavaScript's Date.now()) in BIGINT columns; days are
 * 'YYYY-MM-DD' text in the center's time zone (APP_TIMEZONE). Deleting a user removes
 * everything that belongs to them (ON DELETE CASCADE).
 */
const SCHEMA = `
BEGIN;
SELECT pg_advisory_xact_lock(727274); -- two servers starting at once take turns

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  password_hash text NOT NULL,          -- scrypt$…: a one-way hash. The password itself is never stored.
  role          text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at    bigint NOT NULL,
  last_seen_at  bigint
);

CREATE TABLE IF NOT EXISTS sessions (
  id         text PRIMARY KEY,          -- SHA-256 of the cookie token; the token itself is never stored
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS words (
  id         text PRIMARY KEY,
  owner_id   text REFERENCES users (id) ON DELETE CASCADE, -- NULL: a shared lesson word; else that person's own word
  data       jsonb NOT NULL,            -- term, meaning, example, memory hook, deck, …
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS words_owner_idx ON words (owner_id);

CREATE TABLE IF NOT EXISTS cards (
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  word_id    text NOT NULL REFERENCES words (id) ON DELETE CASCADE,
  data       jsonb NOT NULL,            -- this person's progress on one word (SM-2 state, recent answers)
  started    smallint NOT NULL DEFAULT 0,
  mature     smallint NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS cards_word_idx ON cards (word_id);

CREATE TABLE IF NOT EXISTS prefs (
  user_id text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data    jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  user_id   text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day       text NOT NULL,
  answers   integer NOT NULL DEFAULT 0,
  new_cards integer NOT NULL DEFAULT 0,
  visits    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS activity_day_idx ON activity (day);

CREATE TABLE IF NOT EXISTS cheers (
  id         text PRIMARY KEY,
  from_user  text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       text NOT NULL,
  day        text NOT NULL,
  created_at bigint NOT NULL,
  seen_at    bigint,
  UNIQUE (from_user, to_user, day)      -- one cheer per classmate per day
);
CREATE INDEX IF NOT EXISTS cheers_to_idx ON cheers (to_user, created_at DESC);

-- Supabase also publishes the public schema through its REST API. Row Level Security with no
-- policies closes that door: only this server (connecting as the table owner) reads the data.
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE words    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prefs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheers   ENABLE ROW LEVEL SECURITY;

INSERT INTO settings (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;
COMMIT;
`;

/** Six characters without look-alikes (no 0/O, 1/I/L), e.g. "K7M2QX". */
export function newJoinCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

const STATUS = `SELECT (SELECT value FROM settings WHERE key = 'schema_version') AS version,
                       (SELECT value FROM settings WHERE key = 'join_code') AS join_code,
                       (SELECT count(*) FROM users)::int AS users`;

async function migrate(db: Db): Promise<void> {
  let status = await db.query(STATUS).catch(() => null); // fails when the tables don't exist yet
  if (status?.rows[0]?.version !== SCHEMA_VERSION) {
    await db.query(SCHEMA);
    // First start: load the Lektion 3 words as shared words. One statement, so it happens exactly
    // once even with several servers, and deleting them all later doesn't bring them back.
    const now = Date.now();
    await db.query(
      `WITH first AS (INSERT INTO settings (key, value) VALUES ('seeded', '1') ON CONFLICT (key) DO NOTHING RETURNING 1)
       INSERT INTO words (id, owner_id, data, updated_at)
       SELECT x.id, NULL, x.data, $2 FROM jsonb_to_recordset($1::jsonb) AS x(id text, data jsonb), first
       ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(Object.values(seedWords(now)).map(({ id, ...data }) => ({ id, data }))), now],
    );
    // The code students need to create a profile. JOIN_CODE sets the first one; the admin can change it later.
    const initialCode = process.env.JOIN_CODE?.trim().toUpperCase() || newJoinCode();
    await db.query(`INSERT INTO settings (key, value) VALUES ('join_code', $1) ON CONFLICT (key) DO NOTHING`, [initialCode]);
    status = await db.query(STATUS);
  }
  const s = status.rows[0];
  if (Number(s.users) === 0) {
    console.log(`\n  Karteikasten: no profiles yet. Sign up with join code ${s.join_code} — the first profile becomes the admin.\n`);
  }
}

/* ---------- connecting ---------- */

const g = globalThis as typeof globalThis & { __kkDb?: { db: Db; ready: Promise<void> } };

// BIGINT (ms timestamps, counts) and NUMERIC come back from Postgres as strings by default.
// Our values fit safely in a JavaScript number, so read them as numbers.
const toNumber = (v: string) => Number(v);
const typeParser = ((oid: number, format?: string) =>
  oid === 20 || oid === 1700 ? toNumber : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser;

function poolConfig(): pg.PoolConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set. Put your Supabase connection string in .env.local (see README → Supabase).');
  }
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.searchParams.get('sslmode') === 'disable';
  url.searchParams.delete('sslmode'); // TLS is configured below
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
  return {
    connectionString: url.toString(),
    // Supabase requires TLS. With DATABASE_CA_CERT (Supabase → Settings → Database → SSL) the
    // server's certificate is verified too; without it the connection is encrypted but not pinned.
    ssl: local ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    types: { getTypeParser: typeParser },
  };
}

function pgDb(): Db {
  const pool = new pg.Pool(poolConfig());
  // A dropped idle connection must not crash the server; the pool replaces it.
  pool.on('error', (e) => console.error('Karteikasten: database connection error.', e.message));
  return {
    async query<R extends Row>(text: string, params?: unknown[]) {
      const r = (await pool.query(text, params)) as pg.QueryResult<R> | pg.QueryResult<R>[];
      const last = Array.isArray(r) ? r[r.length - 1] : r; // a script returns one result per statement
      return { rows: last?.rows ?? [], rowCount: last?.rowCount ?? 0 };
    },
  };
}

function open(db: Db) {
  const ready = migrate(db);
  g.__kkDb = { db, ready };
  ready.catch(() => {
    if (g.__kkDb?.db === db) g.__kkDb = undefined; // let the next request retry
  });
}

export async function getDb(): Promise<Db> {
  if (!g.__kkDb) open(pgDb());
  await g.__kkDb!.ready;
  return g.__kkDb!.db;
}

/** Tests: run the app's queries against another database (an in-memory Postgres). */
export function setDatabase(db: Db): void {
  open(db);
}
