/**
 * Every database query lives here (the "data access layer").
 * Route handlers and server actions call these functions after checking who the user is;
 * progress queries always take the user id, so one student can never read another's cards.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { InStatement, Row } from '@libsql/client';
import { cardFlags, dayKey, diffActivity, lastDays, safeTimeZone, shiftDay, streakFrom } from '../stats';
import { DEFAULT_PREFS, type CardDoc, type Cheer, type CheerKind, type ClassData, type ClassMember, type Me, type Prefs, type Role, type Word } from '../types';
import { getDb, newJoinCode } from './db';
import { sanitizeCard, sanitizePrefs, sanitizeWord } from './validate';

export const TIMEZONE = safeTimeZone(process.env.APP_TIMEZONE);
export const todayKey = (now = Date.now()) => dayKey(now, TIMEZONE);

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));
const parse = <T>(v: unknown): T | null => {
  try {
    return JSON.parse(str(v)) as T;
  } catch {
    return null;
  }
};

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
  const r = await db.execute({ sql: `SELECT ${USER_COLS} FROM users WHERE username = ?`, args: [username] });
  return r.rows[0] ? toUser(r.rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const db = await getDb();
  const r = await db.execute({ sql: `SELECT ${USER_COLS} FROM users WHERE id = ?`, args: [id] });
  return r.rows[0] ? toUser(r.rows[0]) : null;
}

/**
 * Create a profile. The very first profile becomes the admin; the role is decided inside
 * the INSERT itself, so two people signing up at the same moment can't both become admin.
 */
export async function createUser(input: { username: string; displayName: string; passwordHash: string }, now = Date.now()): Promise<UserRow | 'taken'> {
  const db = await getDb();
  const id = `u_${randomBytes(12).toString('base64url')}`;
  try {
    await db.execute({
      sql: `INSERT INTO users (id, username, display_name, password_hash, role, created_at, last_seen_at)
            SELECT ?, ?, ?, ?, CASE WHEN (SELECT count(*) FROM users) = 0 THEN 'admin' ELSE 'student' END, ?, ?`,
      args: [id, input.username, input.displayName, input.passwordHash, now, now],
    });
  } catch (e) {
    if (/UNIQUE/i.test(String((e as Error).message))) return 'taken';
    throw e;
  }
  await recordVisit(id, now);
  return (await findUserById(id))!;
}

export async function setPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [passwordHash, userId] });
}

export async function setRole(userId: string, role: Role): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: [role, userId] });
}

/** Remove a profile and everything that belongs to it. */
export async function deleteUser(userId: string): Promise<void> {
  const db = await getDb();
  await db.batch(
    [
      { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM cards WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM prefs WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM activity WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM cheers WHERE from_user = ? OR to_user = ?', args: [userId, userId] },
      { sql: 'DELETE FROM users WHERE id = ?', args: [userId] },
    ],
    'write',
  );
}

/** Note that someone opened the app (at most every few minutes): feeds "active today" for the admin. */
export async function recordVisit(userId: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.batch(
    [
      { sql: 'UPDATE users SET last_seen_at = ? WHERE id = ?', args: [now, userId] },
      {
        sql: `INSERT INTO activity (user_id, day, visits) VALUES (?, ?, 1)
              ON CONFLICT (user_id, day) DO UPDATE SET visits = visits + 1`,
        args: [userId, todayKey(now)],
      },
    ],
    'write',
  );
}

/* ============================== sessions ============================== */

/** Only a SHA-256 of the cookie token is stored, so a leaked database can't be used to log in. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string, ttlMs: number, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
  const db = await getDb();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = now + ttlMs;
  await db.batch(
    [
      { sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [now] }, // housekeeping
      { sql: 'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', args: [hashToken(token), userId, now, expiresAt] },
    ],
    'write',
  );
  return { token, expiresAt };
}

export async function findSession(token: string, now = Date.now()): Promise<{ user: UserRow; expiresAt: number } | null> {
  const db = await getDb();
  const r = await db.execute({
    sql: `SELECT ${USER_COLS.split(', ').map((c) => `u.${c}`).join(', ')}, s.expires_at AS session_expires
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.expires_at > ?`,
    args: [hashToken(token), now],
  });
  const row = r.rows[0];
  return row ? { user: toUser(row), expiresAt: num(row.session_expires) } : null;
}

export async function extendSession(token: string, expiresAt: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'UPDATE sessions SET expires_at = ? WHERE id = ?', args: [expiresAt, hashToken(token)] });
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [hashToken(token)] });
}

/** Sign a person out everywhere (after a password change or reset), optionally keeping one session. */
export async function deleteUserSessions(userId: string, keepToken?: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ? AND id != ?', args: [userId, keepToken ? hashToken(keepToken) : ''] });
}

/* ============================== words (shared by the whole center) ============================== */

export async function listWords(): Promise<Record<string, Word>> {
  const db = await getDb();
  const out: Record<string, Word> = {};
  for (const r of (await db.execute('SELECT id, data FROM words')).rows) {
    const w = sanitizeWord(parse(r.data));
    if (w) out[str(r.id)] = { ...w, id: str(r.id) };
  }
  return out;
}

export async function putWords(words: Word[], now = Date.now()): Promise<void> {
  if (!words.length) return;
  const db = await getDb();
  await db.batch(
    words.map(({ id, ...data }) => ({
      sql: `INSERT INTO words (id, data, updated_at) VALUES (?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [id, JSON.stringify(data), now],
    })),
    'write',
  );
}

/** Deleting a word also removes everyone's progress on it. */
export async function deleteWord(id: string): Promise<void> {
  const db = await getDb();
  await db.batch(
    [
      { sql: 'DELETE FROM words WHERE id = ?', args: [id] },
      { sql: 'DELETE FROM cards WHERE word_id = ?', args: [id] },
    ],
    'write',
  );
}

/* ============================== progress (per person) ============================== */

export async function listCards(userId: string): Promise<Record<string, CardDoc>> {
  const db = await getDb();
  const out: Record<string, CardDoc> = {};
  for (const r of (await db.execute({ sql: 'SELECT word_id, data FROM cards WHERE user_id = ?', args: [userId] })).rows) {
    const c = sanitizeCard(parse(r.data));
    if (c) out[str(r.word_id)] = c;
  }
  return out;
}

/** Save (or with null, reset) one word's progress and count the new answers toward today's activity. */
export async function putCard(userId: string, wordId: string, doc: CardDoc | null, now = Date.now()): Promise<'ok' | 'no-word'> {
  const db = await getDb();
  const [word, prevRow] = await db.batch(
    [
      { sql: 'SELECT 1 FROM words WHERE id = ?', args: [wordId] },
      { sql: 'SELECT data FROM cards WHERE user_id = ? AND word_id = ?', args: [userId, wordId] },
    ],
    'read',
  );
  if (!word.rows.length && doc) return 'no-word';
  const prev = prevRow.rows[0] ? sanitizeCard(parse(prevRow.rows[0].data)) : null;
  const stmts: InStatement[] = [];
  if (doc) {
    const flags = cardFlags(doc);
    stmts.push({
      sql: `INSERT INTO cards (user_id, word_id, data, started, mature, updated_at) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, word_id) DO UPDATE SET data = excluded.data, started = excluded.started,
              mature = excluded.mature, updated_at = excluded.updated_at`,
      args: [userId, wordId, JSON.stringify(doc), flags.started, flags.mature, now],
    });
    const { answers, newCards } = diffActivity(prev, doc);
    if (answers || newCards) {
      stmts.push({
        sql: `INSERT INTO activity (user_id, day, answers, new_cards) VALUES (?, ?, ?, ?)
              ON CONFLICT (user_id, day) DO UPDATE SET answers = answers + excluded.answers, new_cards = new_cards + excluded.new_cards`,
        args: [userId, todayKey(now), answers, newCards],
      });
    }
  } else {
    stmts.push({ sql: 'DELETE FROM cards WHERE user_id = ? AND word_id = ?', args: [userId, wordId] });
  }
  await db.batch(stmts, 'write');
  return 'ok';
}

export async function deleteAllCards(userId: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM cards WHERE user_id = ?', args: [userId] });
}

export async function getPrefs(userId: string): Promise<Prefs> {
  const db = await getDb();
  const r = await db.execute({ sql: 'SELECT data FROM prefs WHERE user_id = ?', args: [userId] });
  return sanitizePrefs(r.rows[0] ? parse(r.rows[0].data) : null, DEFAULT_PREFS);
}

export async function putPrefs(userId: string, patch: unknown): Promise<Prefs> {
  const prefs = sanitizePrefs(patch, await getPrefs(userId));
  const db = await getDb();
  await db.execute({
    sql: 'INSERT INTO prefs (user_id, data) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data',
    args: [userId, JSON.stringify(prefs)],
  });
  return prefs;
}

/* ============================== cheers ============================== */

export async function sendCheer(fromId: string, toId: string, kind: CheerKind, now = Date.now()): Promise<'ok' | 'already' | 'no-user' | 'self'> {
  if (fromId === toId) return 'self';
  if (!(await findUserById(toId))) return 'no-user';
  const db = await getDb();
  const r = await db.execute({
    sql: 'INSERT OR IGNORE INTO cheers (id, from_user, to_user, kind, day, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [`c_${randomBytes(9).toString('base64url')}`, fromId, toId, kind, todayKey(now), now],
  });
  return r.rowsAffected ? 'ok' : 'already';
}

export async function unseenCheers(userId: string): Promise<Cheer[]> {
  const db = await getDb();
  const r = await db.execute({
    sql: `SELECT c.id, c.kind, c.created_at, u.id AS from_id, u.display_name, u.username
          FROM cheers c JOIN users u ON u.id = c.from_user
          WHERE c.to_user = ? AND c.seen_at IS NULL ORDER BY c.created_at DESC LIMIT 20`,
    args: [userId],
  });
  return r.rows.map((row) => ({
    id: str(row.id),
    kind: str(row.kind) as CheerKind,
    createdAt: num(row.created_at),
    from: { id: str(row.from_id), displayName: str(row.display_name), username: str(row.username) },
  }));
}

export async function markCheersSeen(userId: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'UPDATE cheers SET seen_at = ? WHERE to_user = ? AND seen_at IS NULL', args: [now, userId] });
}

/* ============================== class & dashboard ============================== */

interface PersonActivity {
  studyDays: Set<string>;
  answersByDay: Map<string, number>;
  visitDays: Set<string>;
}

async function loadEveryone(now: number) {
  const db = await getDb();
  const since = shiftDay(todayKey(now), -400);
  const [users, cards, acts] = await db.batch(
    [
      'SELECT id, username, display_name, role, created_at, last_seen_at FROM users ORDER BY created_at',
      'SELECT user_id, SUM(started) AS active, SUM(mature) AS mature FROM cards GROUP BY user_id',
      { sql: 'SELECT user_id, day, answers, visits FROM activity WHERE day >= ?', args: [since] },
    ],
    'read',
  );
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
  const { users } = await loadEveryone(now);
  const db = await getDb();
  const cheered = new Set(
    (await db.execute({ sql: 'SELECT to_user FROM cheers WHERE from_user = ? AND day = ?', args: [viewerId, today] })).rows.map((r) => str(r.to_user)),
  );
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
  const { users } = await loadEveryone(now);
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
    joinCode: await getJoinCode(),
  };
}

/* ============================== settings ============================== */

export async function getJoinCode(): Promise<string> {
  const db = await getDb();
  const r = await db.execute(`SELECT value FROM settings WHERE key = 'join_code'`);
  return str(r.rows[0]?.value);
}

export async function setJoinCode(code?: string): Promise<string> {
  const value = (code || newJoinCode()).toUpperCase();
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES ('join_code', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    args: [value],
  });
  return value;
}
