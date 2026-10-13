/**
 * Every database query lives here (the "data access layer").
 * Route handlers and server actions call these functions after checking who the user is;
 * progress queries always take the user id, so one student can never read another's cards,
 * and word queries take the owner, so nobody sees or changes another person's own words.
 *
 * Speed: most functions are a single round trip to Postgres. Where one action touches several
 * tables (save an answer + count it for today), a WITH … INSERT statement does it all at once.
 */
import { createHash, randomBytes } from 'node:crypto';
import { cardFlags, dayKey, diffActivity, lastDays, safeTimeZone, shiftDay, streakFrom } from '../stats';
import {
  DEFAULT_PREFS, MAX_OWN_WORDS,
  type CardDoc, type Cheer, type CheerKind, type ClassData, type ClassMember, type Me, type Prefs, type Role, type Word, type WordData,
} from '../types';
import { getDb, newJoinCode, type Row } from './db';
import { sanitizeCard, sanitizePrefs, sanitizeWord } from './validate';

export const TIMEZONE = safeTimeZone(process.env.APP_TIMEZONE);
export const todayKey = (now = Date.now()) => dayKey(now, TIMEZONE);

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));
/** JSONB columns arrive already parsed; tolerate text too. */
const parse = <T>(v: unknown): T | null => {
  if (v == null) return null;
  if (typeof v !== 'string') return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};
const FOREIGN_KEY_VIOLATION = '23503';

/* ============================== users ============================== */

export interface UserRow extends Me {
  createdAt: number;
  lastSeenAt: number | null;
  passwordHash: string;
}

const USER_COLS = 'id, username, display_name, role, created_at, last_seen_at, password_hash';
function toUser(r: Row): UserRow {
  return {
    id: str(r.id),
    username: str(r.username),
    displayName: str(r.display_name),
    role: r.role === 'admin' ? 'admin' : 'student',
    createdAt: num(r.created_at),
    lastSeenAt: r.last_seen_at == null ? null : num(r.last_seen_at),
    passwordHash: str(r.password_hash),
  };
}
export const publicUser = (u: UserRow): Me => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role });

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const db = await getDb();
  const r = await db.query(`SELECT ${USER_COLS} FROM users WHERE username = $1`, [username]);
  return r.rows[0] ? toUser(r.rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const db = await getDb();
  const r = await db.query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
  return r.rows[0] ? toUser(r.rows[0]) : null;
}

/**
 * Create a profile. The very first profile becomes the admin. Who is first is settled by the
 * unique 'first_admin' settings row inside the same statement, so two people signing up at the
 * same moment can't both become admin.
 */
export async function createUser(input: { username: string; displayName: string; passwordHash: string }, now = Date.now()): Promise<UserRow | 'taken'> {
  const db = await getDb();
  const id = `u_${randomBytes(12).toString('base64url')}`;
  try {
    await db.query(
      `WITH claim AS (
         INSERT INTO settings (key, value) SELECT 'first_admin', $1 WHERE NOT EXISTS (SELECT 1 FROM users)
         ON CONFLICT (key) DO NOTHING RETURNING 1
       ), u AS (
         INSERT INTO users (id, username, display_name, password_hash, role, created_at, last_seen_at)
         SELECT $1, $2, $3, $4, CASE WHEN EXISTS (SELECT 1 FROM claim) THEN 'admin' ELSE 'student' END, $5, $5
         RETURNING id
       )
       INSERT INTO activity (user_id, day, visits) SELECT id, $6, 1 FROM u`,
      [id, input.username, input.displayName, input.passwordHash, now, todayKey(now)],
    );
  } catch (e) {
    if ((e as { code?: string }).code === '23505' || /unique/i.test(String((e as Error).message))) return 'taken';
    throw e;
  }
  return (await findUserById(id))!;
}

export async function setPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
}

export async function setRole(userId: string, role: Role): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE users SET role = $2 WHERE id = $1', [userId, role]);
}

/** Remove a profile and everything that belongs to it (sessions, own words, progress, cheers…). */
export async function deleteUser(userId: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM users WHERE id = $1', [userId]); // ON DELETE CASCADE does the rest
}

/** Note that someone opened the app (at most every few minutes): feeds "active today" for the admin. */
export async function recordVisit(userId: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.query(
    `WITH seen AS (UPDATE users SET last_seen_at = $2 WHERE id = $1 RETURNING id)
     INSERT INTO activity (user_id, day, visits) SELECT id, $3, 1 FROM seen
     ON CONFLICT (user_id, day) DO UPDATE SET visits = activity.visits + 1`,
    [userId, now, todayKey(now)],
  );
}

/* ============================== sessions ============================== */

/** Only a SHA-256 of the cookie token is stored, so a leaked database can't be used to log in. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string, ttlMs: number, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
  const db = await getDb();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = now + ttlMs;
  await db.query(
    `WITH expired AS (DELETE FROM sessions WHERE expires_at < $3) -- housekeeping
     INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
    [hashToken(token), userId, now, expiresAt],
  );
  return { token, expiresAt };
}

export async function findSession(token: string, now = Date.now()): Promise<{ user: UserRow; expiresAt: number } | null> {
  const db = await getDb();
  const r = await db.query(
    `SELECT ${USER_COLS.split(', ').map((c) => `u.${c}`).join(', ')}, s.expires_at AS session_expires
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > $2`,
    [hashToken(token), now],
  );
  const row = r.rows[0];
  return row ? { user: toUser(row), expiresAt: num(row.session_expires) } : null;
}

export async function extendSession(token: string, expiresAt: number): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE sessions SET expires_at = $2 WHERE id = $1', [hashToken(token), expiresAt]);
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM sessions WHERE id = $1', [hashToken(token)]);
}

/** Sign a person out everywhere (after a password change or reset), optionally keeping one session. */
export async function deleteUserSessions(userId: string, keepToken?: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [userId, keepToken ? hashToken(keepToken) : '']);
}

/* ============================== words ============================== */
/*
 * Two kinds of words live in one table:
 *   owner_id IS NULL  → a shared lesson word: everyone studies it, only admins change it
 *   owner_id = <user> → that person's own word: only they see it, study it and change it
 * Admins write shared words; everyone else writes their own. `owner` below is that value.
 */

/** Which words a write goes to: shared (null) for admins, their own for everyone else. */
export const ownerFor = (user: { id: string; role: Role }): string | null => (user.role === 'admin' ? null : user.id);

/** The shared words plus your own (guests: shared only). */
export async function listWords(userId: string | null): Promise<Record<string, Word>> {
  const db = await getDb();
  const r = await db.query('SELECT id, owner_id, data FROM words WHERE owner_id IS NULL OR owner_id = $1', [userId]);
  const out: Record<string, Word> = {};
  for (const row of r.rows) {
    const w = sanitizeWord(parse(row.data));
    if (!w) continue;
    const id = str(row.id);
    out[id] = row.owner_id ? { ...w, id, personal: true } : { ...w, id };
  }
  return out;
}

/**
 * Create or update one word. 'forbidden': the id belongs to a word you may not change
 * (someone else's, or a shared one for a student). 'limit': too many own words.
 */
export async function saveWord(owner: string | null, id: string, data: WordData, now = Date.now()): Promise<'ok' | 'forbidden' | 'limit'> {
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO words (id, owner_id, data, updated_at)
     SELECT $1, $2, $3::jsonb, $4
     WHERE $2::text IS NULL OR EXISTS (SELECT 1 FROM words WHERE id = $1) OR (SELECT count(*) FROM words WHERE owner_id = $2) < $5
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
       WHERE words.owner_id IS NOT DISTINCT FROM excluded.owner_id
     RETURNING id`,
    [id, owner, JSON.stringify(data), now, MAX_OWN_WORDS],
  );
  if (r.rowCount) return 'ok';
  const exists = await db.query('SELECT 1 FROM words WHERE id = $1', [id]);
  return exists.rowCount ? 'forbidden' : 'limit';
}

/** Add many words at once (Import). Ids that belong to someone else are skipped. Returns how many were saved. */
export async function putWords(owner: string | null, words: { id: string; data: WordData }[], now = Date.now()): Promise<number> {
  if (!words.length) return 0;
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO words (id, owner_id, data, updated_at)
     SELECT x.id, $2, x.data, $3 FROM jsonb_to_recordset($1::jsonb) AS x(id text, data jsonb)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
       WHERE words.owner_id IS NOT DISTINCT FROM excluded.owner_id`,
    [JSON.stringify(words), owner, now],
  );
  return r.rowCount;
}

export async function countOwnWords(userId: string): Promise<number> {
  const db = await getDb();
  const r = await db.query('SELECT count(*)::int AS n FROM words WHERE owner_id = $1', [userId]);
  return num(r.rows[0]?.n);
}

/** Delete a word you may change. Everyone's progress on it goes too (ON DELETE CASCADE). */
export async function deleteWord(owner: string | null, id: string): Promise<'ok' | 'forbidden'> {
  const db = await getDb();
  const r = await db.query('DELETE FROM words WHERE id = $1 AND owner_id IS NOT DISTINCT FROM $2 RETURNING id', [id, owner]);
  if (r.rowCount) return 'ok';
  const exists = await db.query('SELECT 1 FROM words WHERE id = $1', [id]);
  return exists.rowCount ? 'forbidden' : 'ok'; // already gone is fine
}

/* ============================== progress (per person) ============================== */

export async function listCards(userId: string): Promise<Record<string, CardDoc>> {
  const db = await getDb();
  const r = await db.query('SELECT word_id, data FROM cards WHERE user_id = $1', [userId]);
  const out: Record<string, CardDoc> = {};
  for (const row of r.rows) {
    const c = sanitizeCard(parse(row.data));
    if (c) out[str(row.word_id)] = c;
  }
  return out;
}

/**
 * Save (or with null, reset) one word's progress and count the new answers toward today's
 * activity. Two round trips: read the previous state, then write the card and the day's
 * activity in one statement.
 */
export async function putCard(userId: string, wordId: string, doc: CardDoc | null, now = Date.now()): Promise<'ok' | 'no-word'> {
  const db = await getDb();
  if (!doc) {
    await db.query('DELETE FROM cards WHERE user_id = $1 AND word_id = $2', [userId, wordId]);
    return 'ok';
  }
  const read = await db.query(
    `SELECT EXISTS (SELECT 1 FROM words WHERE id = $2 AND (owner_id IS NULL OR owner_id = $1)) AS visible,
            (SELECT data FROM cards WHERE user_id = $1 AND word_id = $2) AS prev`,
    [userId, wordId],
  );
  if (!read.rows[0]?.visible) return 'no-word';
  const prev = sanitizeCard(parse(read.rows[0].prev));
  const flags = cardFlags(doc);
  const { answers, newCards } = diffActivity(prev, doc);
  try {
    await db.query(
      `WITH card AS (
         INSERT INTO cards (user_id, word_id, data, started, mature, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5, $6)
         ON CONFLICT (user_id, word_id) DO UPDATE SET data = excluded.data, started = excluded.started,
           mature = excluded.mature, updated_at = excluded.updated_at
       )
       INSERT INTO activity (user_id, day, answers, new_cards) SELECT $1, $7, $8, $9 WHERE $8::int > 0 OR $9::int > 0
       ON CONFLICT (user_id, day) DO UPDATE SET answers = activity.answers + excluded.answers,
         new_cards = activity.new_cards + excluded.new_cards`,
      [userId, wordId, JSON.stringify(doc), flags.started, flags.mature, now, todayKey(now), answers, newCards],
    );
  } catch (e) {
    if ((e as { code?: string }).code === FOREIGN_KEY_VIOLATION) return 'no-word'; // deleted a moment ago
    throw e;
  }
  return 'ok';
}

export async function deleteAllCards(userId: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM cards WHERE user_id = $1', [userId]);
}

/**
 * Add the progress someone made as a guest, before they had a profile. Never overwrites:
 * words already studied in the profile keep that progress, and so do saved settings.
 * Answers given today count toward today's activity. Returns how many words were added.
 * One statement, so the cards, the activity and the settings are saved together or not at all.
 */
export async function importCards(userId: string, cards: Record<string, CardDoc>, prefs?: unknown, now = Date.now()): Promise<number> {
  const today = todayKey(now);
  const isToday = (t: number) => t > 0 && t <= now && todayKey(t) === today;
  const rows = Object.entries(cards).map(([wordId, doc]) => {
    let answers = 0;
    let newCards = 0;
    for (const s of [doc.f, doc.r]) {
      if (!s) continue;
      answers += s.log.filter((e) => isToday(e.t)).length;
      if (s.type !== 'new' && isToday(s.first)) newCards++;
    }
    return { word_id: wordId, data: doc, ...cardFlags(doc), answers, new_cards: newCards };
  });
  if (!rows.length && prefs === undefined) return 0;
  const db = await getDb();
  const r = await db.query(
    `WITH x AS (
       SELECT * FROM jsonb_to_recordset($2::jsonb)
         AS x(word_id text, data jsonb, started int, mature int, answers int, new_cards int)
     ), added AS (
       INSERT INTO cards (user_id, word_id, data, started, mature, updated_at)
       SELECT $1, x.word_id, x.data, x.started, x.mature, $3
       FROM x JOIN words w ON w.id = x.word_id AND (w.owner_id IS NULL OR w.owner_id = $1)
       ON CONFLICT (user_id, word_id) DO NOTHING
       RETURNING word_id
     ), counted AS (
       INSERT INTO activity (user_id, day, answers, new_cards)
       SELECT $1, $4, LEAST(sum(x.answers), 1000), LEAST(sum(x.new_cards), 400)
       FROM x JOIN added ON added.word_id = x.word_id
       HAVING sum(x.answers) > 0 OR sum(x.new_cards) > 0
       ON CONFLICT (user_id, day) DO UPDATE SET answers = activity.answers + excluded.answers,
         new_cards = activity.new_cards + excluded.new_cards
     ), saved_prefs AS (
       INSERT INTO prefs (user_id, data) SELECT $1, $5::jsonb WHERE $5::jsonb IS NOT NULL
       ON CONFLICT (user_id) DO NOTHING
     )
     SELECT count(*)::int AS added FROM added`,
    [userId, JSON.stringify(rows), now, today, prefs === undefined ? null : JSON.stringify(sanitizePrefs(prefs, DEFAULT_PREFS))],
  );
  return num(r.rows[0]?.added);
}

export async function getPrefs(userId: string): Promise<Prefs> {
  const db = await getDb();
  const r = await db.query('SELECT data FROM prefs WHERE user_id = $1', [userId]);
  return sanitizePrefs(r.rows[0] ? parse(r.rows[0].data) : null, DEFAULT_PREFS);
}

export async function putPrefs(userId: string, patch: unknown): Promise<Prefs> {
  const prefs = sanitizePrefs(patch, await getPrefs(userId));
  const db = await getDb();
  await db.query(
    'INSERT INTO prefs (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data',
    [userId, JSON.stringify(prefs)],
  );
  return prefs;
}

/* ============================== cheers ============================== */

export async function sendCheer(fromId: string, toId: string, kind: CheerKind, now = Date.now()): Promise<'ok' | 'already' | 'no-user' | 'self'> {
  if (fromId === toId) return 'self';
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO cheers (id, from_user, to_user, kind, day, created_at)
     SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM users WHERE id = $3)
     ON CONFLICT (from_user, to_user, day) DO NOTHING RETURNING id`,
    [`c_${randomBytes(9).toString('base64url')}`, fromId, toId, kind, todayKey(now), now],
  );
  if (r.rowCount) return 'ok';
  return (await findUserById(toId)) ? 'already' : 'no-user';
}

export async function unseenCheers(userId: string): Promise<Cheer[]> {
  const db = await getDb();
  const r = await db.query(
    `SELECT c.id, c.kind, c.created_at, u.id AS from_id, u.display_name, u.username
     FROM cheers c JOIN users u ON u.id = c.from_user
     WHERE c.to_user = $1 AND c.seen_at IS NULL ORDER BY c.created_at DESC LIMIT 20`,
    [userId],
  );
  return r.rows.map((row) => ({
    id: str(row.id),
    kind: str(row.kind) as CheerKind,
    createdAt: num(row.created_at),
    from: { id: str(row.from_id), displayName: str(row.display_name), username: str(row.username) },
  }));
}

export async function markCheersSeen(userId: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE cheers SET seen_at = $2 WHERE to_user = $1 AND seen_at IS NULL', [userId, now]);
}

/* ============================== class & dashboard ============================== */

interface PersonActivity {
  studyDays: Set<string>;
  answersByDay: Map<string, number>;
  visitDays: Set<string>;
}

/** Everyone with their word counts and the last ~13 months of activity: three queries, run in parallel. */
async function loadEveryone(now: number) {
  const db = await getDb();
  const since = shiftDay(todayKey(now), -400);
  const [users, cards, acts] = await Promise.all([
    db.query('SELECT id, username, display_name, role, created_at, last_seen_at FROM users ORDER BY created_at'),
    db.query('SELECT user_id, sum(started)::int AS active, sum(mature)::int AS mature FROM cards GROUP BY user_id'),
    db.query('SELECT user_id, day, answers, visits FROM activity WHERE day >= $1', [since]),
  ]);
  const counts = new Map(cards.rows.map((r) => [str(r.user_id), { active: num(r.active), mature: num(r.mature) }]));
  const activity = new Map<string, PersonActivity>();
  for (const r of acts.rows) {
    const id = str(r.user_id);
    let a = activity.get(id);
    if (!a) activity.set(id, (a = { studyDays: new Set(), answersByDay: new Map(), visitDays: new Set() }));
    const answers = num(r.answers);
    if (answers > 0) {
      a.studyDays.add(str(r.day));
      a.answersByDay.set(str(r.day), answers);
    }
    if (answers > 0 || num(r.visits) > 0) a.visitDays.add(str(r.day));
  }
  const empty: PersonActivity = { studyDays: new Set(), answersByDay: new Map(), visitDays: new Set() };
  return {
    users: users.rows.map((r) => ({
      id: str(r.id),
      username: str(r.username),
      displayName: str(r.display_name),
      role: (r.role === 'admin' ? 'admin' : 'student') as Role,
      createdAt: num(r.created_at),
      lastSeenAt: r.last_seen_at == null ? null : num(r.last_seen_at),
      ...(counts.get(str(r.id)) ?? { active: 0, mature: 0 }),
      act: activity.get(str(r.id)) ?? empty,
    })),
  };
}

const sumDays = (a: PersonActivity, days: string[]) => days.reduce((n, d) => n + (a.answersByDay.get(d) ?? 0), 0);

/** Everyone in the center, with the numbers the Class tab shows. */
export async function classOverview(viewerId: string, now = Date.now()): Promise<ClassData> {
  const today = todayKey(now);
  const week = lastDays(today, 7);
  const db = await getDb();
  const [{ users }, cheers] = await Promise.all([
    loadEveryone(now),
    db.query('SELECT to_user FROM cheers WHERE from_user = $1 AND day = $2', [viewerId, today]),
  ]);
  const cheered = new Set(cheers.rows.map((r) => str(r.to_user)));
  const members: ClassMember[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    activeWords: u.active,
    matureWords: u.mature,
    streak: streakFrom(u.act.studyDays, today),
    studiedToday: u.act.studyDays.has(today),
    answersToday: u.act.answersByDay.get(today) ?? 0,
    answersWeek: sumDays(u.act, week),
    cheeredToday: cheered.has(u.id),
    isMe: u.id === viewerId,
  }));
  return { today, members };
}

export interface AdminStats {
  today: string;
  timeZone: string;
  totals: {
    profiles: number;
    admins: number;
    newThisWeek: number;
    studiedToday: number; // daily active (answered at least one card)
    openedToday: number; // opened the app today
    activeWeek: number; // studied in the last 7 days
    activeMonth: number; // studied in the last 30 days
    answersToday: number;
  };
  days: string[]; // last 30 days, oldest first
  studiedByDay: number[];
  openedOnlyByDay: number[];
  signupsByDay: number[];
  people: {
    id: string;
    username: string;
    displayName: string;
    role: Role;
    createdAt: number;
    joinedDay: string; // 'YYYY-MM-DD' in the center's time zone
    lastSeenAt: number | null;
    streak: number;
    activeWords: number;
    matureWords: number;
    answersWeek: number;
    studiedToday: boolean;
  }[];
  joinCode: string;
}

export async function adminStats(now = Date.now()): Promise<AdminStats> {
  const today = todayKey(now);
  const days = lastDays(today, 30);
  const week = lastDays(today, 7);
  const [{ users }, joinCode] = await Promise.all([loadEveryone(now), getJoinCode()]);
  const studiedOn = (day: string) => users.filter((u) => u.act.studyDays.has(day)).length;
  const studiedIn = (range: string[]) => users.filter((u) => range.some((d) => u.act.studyDays.has(d))).length;
  const createdDay = (u: (typeof users)[number]) => dayKey(u.createdAt, TIMEZONE);
  return {
    today,
    timeZone: TIMEZONE,
    totals: {
      profiles: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      newThisWeek: users.filter((u) => createdDay(u) >= week[0]).length,
      studiedToday: studiedOn(today),
      openedToday: users.filter((u) => u.act.visitDays.has(today)).length,
      activeWeek: studiedIn(week),
      activeMonth: studiedIn(days),
      answersToday: users.reduce((n, u) => n + (u.act.answersByDay.get(today) ?? 0), 0),
    },
    days,
    studiedByDay: days.map(studiedOn),
    openedOnlyByDay: days.map((d) => users.filter((u) => u.act.visitDays.has(d) && !u.act.studyDays.has(d)).length),
    signupsByDay: days.map((d) => users.filter((u) => createdDay(u) === d).length),
    people: users
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        joinedDay: createdDay(u),
        lastSeenAt: u.lastSeenAt,
        streak: streakFrom(u.act.studyDays, today),
        activeWords: u.active,
        matureWords: u.mature,
        answersWeek: sumDays(u.act, week),
        studiedToday: u.act.studyDays.has(today),
      }))
      .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)),
    joinCode,
  };
}

/* ============================== settings ============================== */

export async function getJoinCode(): Promise<string> {
  const db = await getDb();
  const r = await db.query(`SELECT value FROM settings WHERE key = 'join_code'`);
  return str(r.rows[0]?.value);
}

export async function setJoinCode(code?: string): Promise<string> {
  const value = (code || newJoinCode()).toUpperCase();
  const db = await getDb();
  await db.query(
    `INSERT INTO settings (key, value) VALUES ('join_code', $1) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [value],
  );
  return value;
}
