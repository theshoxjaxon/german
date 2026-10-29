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
import pg from 'pg';
import { packWords, SEED_COURSES, SEED_PACKS } from '../seed';
import { safeTimeZone } from '../stats';

export type Row = Record<string, unknown>;

/** The one method the app needs: a statement with $1…$n parameters (or, without parameters, a script). */
export interface Db {
  query<R extends Row = Row>(text: string, params?: unknown[]): Promise<{ rows: R[]; rowCount: number }>;
}

/** Bump when the schema or the built-in word lists change: every database then runs migrate() once more. */
const SCHEMA_VERSION = '10';

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
  username      text UNIQUE,            -- profiles made before schema 6 only: sign-in is by email now
  display_name  text NOT NULL,
  password_hash text,                   -- bcrypt: a one-way hash, never the password. NULL: Google only.
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

-- Analytics (schema 3). The North Star counts a word as mastered the first time its review gap
-- reaches 21 days; recall rate is the share of reviews answered Good or Easy.
ALTER TABLE cards    ADD COLUMN IF NOT EXISTS mastered_at bigint;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS reviews  integer NOT NULL DEFAULT 0;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS recalled integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS cards_mastered_idx ON cards (mastered_at) WHERE mastered_at IS NOT NULL;

-- Browsers that opened the app without a profile, for the Visit → Try → Join funnel. The id is a
-- random string the browser made up: no name, no IP address, nothing personal.
CREATE TABLE IF NOT EXISTS visitors (
  id        text PRIMARY KEY,
  first_day text NOT NULL,
  last_day  text NOT NULL,
  tried_day text,                     -- first day it answered a card as a guest
  user_id   text REFERENCES users (id) ON DELETE SET NULL, -- the profile created in this browser
  joined_day text
);
CREATE INDEX IF NOT EXISTS visitors_first_idx ON visitors (first_day);

-- Schema 4: signing up without the class code makes a self-learner (in_class = false). Everyone
-- from before needed the code, so they are in the class.
ALTER TABLE users ADD COLUMN IF NOT EXISTS in_class boolean NOT NULL DEFAULT true;

-- Schema 6: you sign in with your email address, and a password, Google, or both.
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email          text;    -- always lowercase
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false; -- proven via Google or a reset link
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id      text;    -- Google's account id ("sub")
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     text;    -- the Google profile photo
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at     bigint;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users (google_id);

-- Links for "Forgot password": only a SHA-256 of the token is stored, like session tokens.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  used_at    bigint                     -- set when the link is used: each link works once
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);

-- Attempts per IP address or email (hashed) for login, sign-up and password links; see rate-limit.ts.
CREATE TABLE IF NOT EXISTS rate_limits (
  key      text PRIMARY KEY,
  hits     integer NOT NULL,
  reset_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits (reset_at);

-- No class code for now: everyone who signs up is in the one class. Run once, so a teacher
-- taking someone off the leaderboard later isn't undone by the next schema change.
WITH once AS (INSERT INTO settings (key, value) VALUES ('open_class', '1') ON CONFLICT (key) DO NOTHING RETURNING 1)
UPDATE users SET in_class = true WHERE NOT in_class AND EXISTS (SELECT 1 FROM once);

-- Schema 9: courses (German · Momente, English …). Each has its own words, members, leaderboard
-- and current lesson; one login works for all of them. Everything from before is German.
CREATE TABLE IF NOT EXISTS courses (
  id             text PRIMARY KEY,      -- also its link: /c/<id>
  name           text NOT NULL,
  target_lang    text NOT NULL,         -- the language studied: de, en
  meaning_lang   text NOT NULL DEFAULT 'uz',
  note           text NOT NULL DEFAULT '', -- e.g. "More words coming soon"
  current_lesson text,                  -- the deck the class is on
  sort           integer NOT NULL DEFAULT 0,
  created_at     bigint NOT NULL
);
INSERT INTO courses (id, name, target_lang, sort, created_at)
VALUES ('german', 'German · Momente', 'de', 1, (extract(epoch FROM now()) * 1000)::bigint)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE words ADD COLUMN IF NOT EXISTS course_id text REFERENCES courses (id) ON DELETE CASCADE;
UPDATE words SET course_id = 'german' WHERE course_id IS NULL;
ALTER TABLE words ALTER COLUMN course_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS words_course_idx ON words (course_id);

-- Who studies (or teaches) which course. on_board: listed on that course's leaderboard.
CREATE TABLE IF NOT EXISTS course_members (
  course_id text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  user_id   text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  on_board  boolean NOT NULL DEFAULT true,
  joined_at bigint NOT NULL,
  PRIMARY KEY (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS course_members_user_idx ON course_members (user_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS course_id text REFERENCES courses (id) ON DELETE SET NULL; -- the active course
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS course_id text REFERENCES courses (id) ON DELETE SET NULL;

-- Once: everyone so far studied German. Admins teach it; the leaderboard and the class lesson carry over.
WITH once AS (
  INSERT INTO settings (key, value) VALUES ('courses_migrated', '1') ON CONFLICT (key) DO NOTHING RETURNING 1
), members AS (
  INSERT INTO course_members (course_id, user_id, role, on_board, joined_at)
  SELECT 'german', u.id, CASE WHEN u.role = 'admin' THEN 'teacher' ELSE 'student' END, u.in_class, u.created_at
  FROM users u, once
  ON CONFLICT (course_id, user_id) DO NOTHING
), lesson AS (
  UPDATE courses SET current_lesson = (SELECT value FROM settings WHERE key = 'class_lesson')
  WHERE id = 'german' AND EXISTS (SELECT 1 FROM once)
), guests AS (
  UPDATE visitors SET course_id = 'german' WHERE course_id IS NULL AND EXISTS (SELECT 1 FROM once)
)
UPDATE users SET course_id = 'german' WHERE course_id IS NULL AND EXISTS (SELECT 1 FROM once);

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
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_members ENABLE ROW LEVEL SECURITY;

INSERT INTO settings (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;
COMMIT;
`;

/**
 * Fill the analytics columns from history the app already kept: every card stores its last 30
 * answers. Runs once per database (the settings flag), in one statement.
 */
const BACKFILL = `
WITH once AS (
  INSERT INTO settings (key, value) VALUES ('analytics_backfill', '1') ON CONFLICT (key) DO NOTHING RETURNING 1
), entries AS (
  SELECT c.user_id, c.word_id, (e->>'t')::numeric::bigint AS t, e->>'r' AS r, e->>'k' AS k, (e->>'i')::numeric AS i
  FROM cards c CROSS JOIN once,
  LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(c.data->'f'->'log') = 'array' THEN c.data->'f'->'log' ELSE '[]'::jsonb END ||
    CASE WHEN jsonb_typeof(c.data->'r'->'log') = 'array' THEN c.data->'r'->'log' ELSE '[]'::jsonb END
  ) AS e
), mastered AS (
  UPDATE cards c SET mastered_at = m.t
  FROM (SELECT user_id, word_id, min(t) AS t FROM entries WHERE i >= 21 GROUP BY 1, 2) m
  WHERE c.user_id = m.user_id AND c.word_id = m.word_id AND c.mastered_at IS NULL
)
INSERT INTO activity (user_id, day, reviews, recalled)
SELECT user_id, to_char(to_timestamp(t / 1000.0) AT TIME ZONE $1, 'YYYY-MM-DD'), count(*), count(*) FILTER (WHERE r IN ('good', 'easy'))
FROM entries WHERE k = 'review' GROUP BY 1, 2
ON CONFLICT (user_id, day) DO UPDATE SET reviews = excluded.reviews, recalled = excluded.recalled`;

async function backfillAnalytics(db: Db): Promise<void> {
  try {
    await db.query(BACKFILL, [safeTimeZone(process.env.APP_TIMEZONE)]);
  } catch (e) {
    // Only the history before this version is affected; new answers are counted as they come in.
    console.error('Karteikasten: could not fill in past analytics.', (e as Error).message);
  }
}

const STATUS = `SELECT (SELECT value FROM settings WHERE key = 'schema_version') AS version,
                       (SELECT count(*) FROM users WHERE role = 'admin')::int AS admins`;

async function migrate(db: Db): Promise<void> {
  let status = await db.query(STATUS).catch(() => null); // fails when the tables don't exist yet
  if (status?.rows[0]?.version !== SCHEMA_VERSION) {
    await db.query(SCHEMA);
    const now = Date.now();
    // The built-in courses. An existing course is left as it is (a teacher may have renamed it).
    await db.query(
      `INSERT INTO courses (id, name, target_lang, note, sort, created_at)
       SELECT x.id, x.name, x."targetLang", x.note, x.sort, $2 FROM jsonb_to_recordset($1::jsonb)
         AS x(id text, name text, "targetLang" text, note text, sort int)
       ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(SEED_COURSES), now],
    );
    // Load each built-in list (Lektion 3, Lektion 5, …) as shared words of its course, once per
    // database. One statement per list, so it happens exactly once even with several servers,
    // and deleting the words later doesn't bring them back. Words the course already has (same
    // term, shared) are skipped, so a list typed in by hand isn't doubled.
    for (const pack of SEED_PACKS) {
      await db.query(
        `WITH first AS (INSERT INTO settings (key, value) VALUES ($3, '1') ON CONFLICT (key) DO NOTHING RETURNING 1)
         INSERT INTO words (id, owner_id, course_id, data, updated_at)
         SELECT x.id, NULL, $4, x.data, $2 FROM jsonb_to_recordset($1::jsonb) AS x(id text, data jsonb), first
         WHERE NOT EXISTS (
           SELECT 1 FROM words w WHERE w.owner_id IS NULL AND w.course_id = $4 AND lower(w.data->>'term') = lower(x.data->>'term')
         )
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(Object.values(packWords(pack, now)).map(({ id, ...data }) => ({ id, data }))), now, pack.flag, pack.course],
      );
    }
    await backfillAnalytics(db);
    status = await db.query(STATUS);
  }
  if (Number(status.rows[0].admins) === 0) {
    console.log(
      process.env.ADMIN_EMAILS?.trim()
        ? '\n  Karteikasten: no teacher yet. Sign in with Google as an ADMIN_EMAILS address (or sign up, then confirm the address once with “Forgot password”) to become the admin.\n'
        : '\n  Karteikasten: no teacher yet. Set ADMIN_EMAILS to your email address (see .env.example), then sign in with it.\n',
    );
  }
}

/* ---------- connecting ---------- */

const g = globalThis as typeof globalThis & { __kkDb?: { db: Db; ready: Promise<void> } };

// BIGINT (ms timestamps, counts) and NUMERIC come back from Postgres as strings by default.
// Our values fit safely in a JavaScript number, so read them as numbers.
const toNumber = (v: string) => Number(v);
const typeParser = ((oid: number, format?: string) =>
  oid === 20 || oid === 1700 ? toNumber : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser;

/** A setup mistake (not a database outage): DATABASE_URL missing, malformed or still a template. */
export class DbConfigError extends Error {
  constructor(public problem: 'missing' | 'bad-url' | 'placeholder', message: string) {
    super(message);
  }
}

/**
 * Read DATABASE_URL. Passwords often contain characters that mean something in a URL
 * (@ # / ? % +); when the string doesn't parse, the password is URL-encoded for you.
 * Common paste mistakes are forgiven: surrounding quotes, or a leading "DATABASE_URL=".
 * Errors never repeat the string, so the password can't end up in logs.
 */
export function parseDatabaseUrl(raw: string): URL {
  const text = raw
    .trim()
    .replace(/^DATABASE_URL\s*=\s*/, '')
    .replace(/^(['"])([\s\S]*)\1$/, '$2')
    .trim();
  if (/\[YOUR-PASSWORD\]/i.test(text)) {
    throw new DbConfigError('placeholder', 'DATABASE_URL still contains [YOUR-PASSWORD]. Replace it, brackets included, with your database password.');
  }
  try {
    return new URL(text);
  } catch {
    // postgresql://USER:PASSWORD@HOST:PORT/DB?… — the password runs up to the last @.
    const m = /^(postgres(?:ql)?:\/\/)([^:/?#@]+):(.*)@([^@/?#]+(?:\/[^?#]*)?(?:\?[^#]*)?)$/.exec(text);
    if (m) {
      try {
        return new URL(`${m[1]}${m[2]}:${encodeURIComponent(m[3])}@${m[4]}`);
      } catch {
        /* fall through */
      }
    }
    throw new DbConfigError(
      'bad-url',
      'DATABASE_URL is not a valid connection string. Copy it again from Supabase → Connect, and replace [YOUR-PASSWORD] (brackets included) with your database password.',
    );
  }
}

function poolConfig(): pg.PoolConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw?.trim()) {
    throw new DbConfigError(
      'missing',
      'DATABASE_URL is not set on this server. Locally it goes in .env.local; on Vercel in Project → Settings → Environment Variables (then redeploy).',
    );
  }
  const url = parseDatabaseUrl(raw);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.searchParams.get('sslmode') === 'disable';
  url.searchParams.delete('sslmode'); // TLS is configured below
  url.searchParams.delete('pgbouncer'); // a Prisma setting some guides add; not used here
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
