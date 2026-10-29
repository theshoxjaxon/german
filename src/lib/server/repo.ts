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
import { COHORTS, computeAnalytics, WEEKS, type Analytics, type Period } from '../analytics';
import { DEFAULT_COURSE, isTargetLang, type Course, type TargetLang } from '../courses';
import { cardFlags, dayKey, diffActivity, isRecalled, lastDays, masteredAt, safeTimeZone, shiftDay, streakFrom } from '../stats';
import {
  DEFAULT_PREFS, MAX_OWN_WORDS,
  type CardDoc, type Cheer, type CheerKind, type ClassData, type ClassMember, type Me, type Prefs, type Role, type Word, type WordData,
} from '../types';
import { DAY } from '../time';
import { isAdminEmail } from './admins';
import { getDb, type Row } from './db';
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
  email: string; // '' for profiles made before sign-in by email
  emailVerified: boolean;
  googleId: string | null;
  passwordHash: string | null; // null: signs in with Google only
  createdAt: number;
  lastSeenAt: number | null;
  member: boolean; // a member of their active course (false only for a profile older than courses)
}

/*
 * A user always comes with their active course and their membership in it, so every route knows
 * which course's words, leaderboard and teacher rights apply without asking the browser.
 * No active course yet (or it was deleted): the default course.
 */
const USER_SELECT = `u.id, u.email, u.email_verified, u.google_id, u.avatar_url, u.display_name, u.role, u.created_at,
  u.last_seen_at, u.password_hash, coalesce(u.course_id, '${DEFAULT_COURSE}') AS active_course,
  m.user_id IS NOT NULL AS member, m.role AS course_role, m.on_board`;
const USER_FROM = `users u LEFT JOIN course_members m ON m.user_id = u.id AND m.course_id = coalesce(u.course_id, '${DEFAULT_COURSE}')`;
function toUser(r: Row): UserRow {
  const role: Role = r.role === 'admin' ? 'admin' : 'student';
  return {
    id: str(r.id),
    email: str(r.email),
    emailVerified: r.email_verified === true,
    googleId: r.google_id == null ? null : str(r.google_id),
    avatarUrl: r.avatar_url == null ? null : str(r.avatar_url),
    displayName: str(r.display_name),
    role,
    courseId: str(r.active_course),
    teacher: role === 'admin' || r.course_role === 'teacher', // admins teach every course
    inClass: r.on_board === true,
    member: r.member === true,
    hasPassword: r.password_hash != null,
    hasGoogle: r.google_id != null,
    createdAt: num(r.created_at),
    lastSeenAt: r.last_seen_at == null ? null : num(r.last_seen_at),
    passwordHash: r.password_hash == null ? null : str(r.password_hash),
  };
}

/** What the browser gets about you. Email addresses are for admins only, their own included. */
export const publicUser = (u: UserRow): Me => ({
  id: u.id,
  displayName: u.displayName,
  role: u.role,
  courseId: u.courseId,
  teacher: u.teacher,
  inClass: u.inClass,
  avatarUrl: u.avatarUrl,
  hasPassword: u.hasPassword,
  hasGoogle: u.hasGoogle,
  ...(u.role === 'admin' && u.email ? { email: u.email } : {}),
});

/** `email` must already be normalized (lowercase, trimmed): see normalizeEmail(). */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  if (!email) return null;
  const db = await getDb();
  const r = await db.query(`SELECT ${USER_SELECT} FROM ${USER_FROM} WHERE u.email = $1`, [email]);
  return r.rows[0] ? toUser(r.rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const db = await getDb();
  const r = await db.query(`SELECT ${USER_SELECT} FROM ${USER_FROM} WHERE u.id = $1`, [id]);
  return r.rows[0] ? toUser(r.rows[0]) : null;
}

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === '23505' || /unique/i.test(String((e as Error).message));

/**
 * Create a profile in a course (`courseId`: the one the person picked or followed a link to;
 * unknown → the default course). Everyone is on its leaderboard (no class code for now). An
 * ADMIN_EMAILS address becomes admin right away only when it is already verified (signing up with
 * Google). `visitorId` (the browser's anonymous id) records that this browser joined, for the
 * Visit → Try → Join funnel. 'taken': the email (or Google account) already has a profile.
 */
export async function createUser(
  input: {
    email: string;
    displayName: string;
    passwordHash?: string | null;
    googleId?: string | null;
    avatarUrl?: string | null;
    emailVerified?: boolean;
    visitorId?: string | null;
    courseId?: string | null;
  },
  now = Date.now(),
): Promise<UserRow | 'taken'> {
  const db = await getDb();
  const id = `u_${randomBytes(12).toString('base64url')}`;
  const verified = input.emailVerified ?? false;
  try {
    await db.query(
      `WITH course AS (
         SELECT coalesce((SELECT id FROM courses WHERE id = $12), (SELECT id FROM courses WHERE id = '${DEFAULT_COURSE}')) AS id
       ), u AS (
         INSERT INTO users (id, email, display_name, password_hash, google_id, avatar_url, email_verified, role, in_class, created_at, updated_at, last_seen_at, course_id)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, true, $9, $9, $9, id FROM course
         RETURNING id, course_id
       ), member AS (
         INSERT INTO course_members (course_id, user_id, joined_at) SELECT course_id, id, $9 FROM u WHERE course_id IS NOT NULL
       ), visitor AS (
         INSERT INTO visitors (id, first_day, last_day, user_id, joined_day, course_id)
         SELECT $11, $10, $10, id, $10, course_id FROM u WHERE $11::text IS NOT NULL
         ON CONFLICT (id) DO UPDATE SET last_day = excluded.last_day, user_id = excluded.user_id, joined_day = excluded.joined_day,
           course_id = coalesce(excluded.course_id, visitors.course_id)
           WHERE visitors.user_id IS NULL
       )
       INSERT INTO activity (user_id, day, visits) SELECT id, $10, 1 FROM u`,
      [
        id, input.email, input.displayName, input.passwordHash ?? null, input.googleId ?? null, input.avatarUrl ?? null,
        verified, verified && isAdminEmail(input.email) ? 'admin' : 'student', now, todayKey(now), input.visitorId ?? null,
        input.courseId ?? null,
      ],
    );
  } catch (e) {
    if (isUniqueViolation(e)) return 'taken';
    throw e;
  }
  return (await findUserById(id))!;
}

/** After a sign-in: an ADMIN_EMAILS address whose owner is proven becomes admin. Returns the user as they are now. */
export async function ensureAdminRole(user: UserRow): Promise<UserRow> {
  if (user.role === 'admin' || !user.emailVerified || !isAdminEmail(user.email)) return user;
  await setRole(user.id, 'admin');
  return { ...user, role: 'admin', teacher: true };
}

export interface GoogleProfile {
  sub: string; // Google's id for the account: stable, unlike the email
  email: string; // normalized
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/**
 * Sign in with Google: find the profile by its Google id, else link the profile with the same
 * email, else create one. Only a verified Google email links or creates, so nobody can claim an
 * address with a Google account that doesn't own it.
 *
 * Linking a profile whose email was never verified also removes its password and signs it out
 * everywhere: whoever set that password never proved the address was theirs, and must not keep
 * a way into the real owner's profile ("pre-account hijacking"). The owner can set a password
 * later with "Forgot password".
 *
 * 'unverified': Google hasn't verified the email. 'other-google': the profile with this email
 * is already linked to a different Google account.
 */
export async function googleSignIn(
  g: GoogleProfile,
  opts: { visitorId?: string | null; courseId?: string | null } = {},
  now = Date.now(),
): Promise<{ user: UserRow; created: boolean } | 'unverified' | 'other-google'> {
  const db = await getDb();
  for (let attempt = 0; attempt < 2; attempt++) {
    const known = await db.query(
      'UPDATE users SET avatar_url = COALESCE($2, avatar_url), updated_at = $3 WHERE google_id = $1 RETURNING id',
      [g.sub, g.picture, now],
    );
    if (known.rows[0]) return { user: (await findUserById(str(known.rows[0].id)))!, created: false };
    if (!g.emailVerified) return 'unverified';

    const linked = await db.query(
      `WITH link AS (
         UPDATE users SET google_id = $2, avatar_url = COALESCE(avatar_url, $3), email_verified = true, updated_at = $4,
           password_hash = CASE WHEN email_verified THEN password_hash END
         WHERE email = $1 AND google_id IS NULL
         RETURNING id, (SELECT NOT email_verified FROM users WHERE email = $1) AS was_unverified
       ), signout AS (
         DELETE FROM sessions WHERE user_id IN (SELECT id FROM link WHERE was_unverified)
       )
       SELECT id FROM link`,
      [g.email, g.sub, g.picture, now],
    );
    if (linked.rows[0]) return { user: (await findUserById(str(linked.rows[0].id)))!, created: false };
    if (await findUserByEmail(g.email)) return 'other-google';

    const created = await createUser(
      { email: g.email, displayName: g.name, googleId: g.sub, avatarUrl: g.picture, emailVerified: true, visitorId: opts.visitorId, courseId: opts.courseId },
      now,
    );
    if (created !== 'taken') return { user: created, created: true };
    // Someone else (or another tab) created it a moment ago: look again
  }
  throw new Error('Google sign-in: the profile changed while signing in. Try again.');
}

export async function setPasswordHash(userId: string, passwordHash: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE users SET password_hash = $2, updated_at = $3 WHERE id = $1', [userId, passwordHash, now]);
}


/* ============================== courses ============================== */

const toCourse = (r: Row): Course => ({
  id: str(r.id),
  name: str(r.name),
  targetLang: (isTargetLang(r.target_lang) ? r.target_lang : 'de') as TargetLang,
  note: str(r.note),
  currentLesson: r.current_lesson ? str(r.current_lesson) : null,
  words: num(r.words),
});
const COURSE_SELECT = `SELECT c.id, c.name, c.target_lang, c.note, c.current_lesson,
  (SELECT count(*)::int FROM words w WHERE w.course_id = c.id AND w.owner_id IS NULL) AS words FROM courses c`;

/** Every course, in the order the picker shows them. */
export async function listCourses(): Promise<Course[]> {
  const db = await getDb();
  const r = await db.query(`${COURSE_SELECT} ORDER BY c.sort, c.name`);
  return r.rows.map(toCourse);
}

export async function getCourse(id: string): Promise<Course | null> {
  const db = await getDb();
  const r = await db.query(`${COURSE_SELECT} WHERE c.id = $1`, [id]);
  return r.rows[0] ? toCourse(r.rows[0]) : null;
}

/** A new course (by an admin). Its id is also its link, /c/<id>. 'taken': that id is in use. */
export async function createCourse(
  c: { id: string; name: string; targetLang: TargetLang; note?: string }, now = Date.now(),
): Promise<'ok' | 'taken'> {
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO courses (id, name, target_lang, note, sort, created_at)
     VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort), 0) + 1 FROM courses), $5)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [c.id, c.name, c.targetLang, c.note ?? '', now],
  );
  return r.rowCount ? 'ok' : 'taken';
}

/**
 * Make `courseId` your active course, joining it first if you're new to it (on its leaderboard,
 * as a student). Your progress in other courses stays. False when there is no such course.
 */
export async function joinCourse(userId: string, courseId: string, now = Date.now()): Promise<boolean> {
  const db = await getDb();
  const r = await db.query(
    `WITH c AS (SELECT id FROM courses WHERE id = $2), m AS (
       INSERT INTO course_members (course_id, user_id, joined_at) SELECT id, $1, $3 FROM c
       ON CONFLICT (course_id, user_id) DO NOTHING
     )
     UPDATE users SET course_id = c.id FROM c WHERE users.id = $1 RETURNING users.id`,
    [userId, courseId, now],
  );
  return r.rowCount > 0;
}

/** Teachers take someone off their course's leaderboard or put them back (off it, they keep studying as usual). */
export async function setOnBoard(courseId: string, userId: string, onBoard: boolean): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE course_members SET on_board = $3 WHERE course_id = $1 AND user_id = $2', [courseId, userId, onBoard]);
}

/** A course's teachers edit its shared words, set its lesson and see its dashboard. */
export async function setCourseRole(courseId: string, userId: string, role: 'student' | 'teacher'): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE course_members SET role = $3 WHERE course_id = $1 AND user_id = $2', [courseId, userId, role]);
}

/** The platform role: admins (ADMIN_EMAILS) run the whole app and teach every course. */
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

/**
 * Someone opened the app without a profile (tried: and answered a card as a guest). Counted per
 * browser and day; the id is random and says nothing about the person.
 */
export async function recordVisitor(visitorId: string, tried: boolean, courseId: string | null, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO visitors (id, first_day, last_day, tried_day, course_id)
     VALUES ($1, $2, $2, CASE WHEN $3::boolean THEN $2 END, (SELECT id FROM courses WHERE id = $4))
     ON CONFLICT (id) DO UPDATE SET last_day = excluded.last_day, tried_day = COALESCE(visitors.tried_day, excluded.tried_day),
       course_id = COALESCE(excluded.course_id, visitors.course_id)`,
    [visitorId, todayKey(now), tried, courseId],
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
    `SELECT ${USER_SELECT}, s.expires_at AS session_expires
     FROM ${USER_FROM} JOIN sessions s ON s.user_id = u.id
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

/* ============================== password links ============================== */

/**
 * A "Forgot password" link: a random 256-bit token, of which only the SHA-256 is stored. A new
 * link replaces this person's older ones, so only the latest email works.
 */
export async function createResetToken(userId: string, ttlMs: number, now = Date.now()): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `WITH old AS (DELETE FROM password_reset_tokens WHERE user_id = $2 OR expires_at < $3)
     INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
    [hashToken(token), userId, now, now + ttlMs],
  );
  return token;
}

/**
 * Use a link to set a new password: once, before it expires. In the same statement the address
 * counts as verified (the email reached its owner) and every session ends, so a stolen session
 * or an old password stops working. Null when the link is unknown, used or expired.
 */
export async function useResetToken(token: string, passwordHash: string, now = Date.now()): Promise<UserRow | null> {
  const db = await getDb();
  const r = await db.query(
    `WITH t AS (
       UPDATE password_reset_tokens SET used_at = $3
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $3
       RETURNING user_id
     ), u AS (
       UPDATE users SET password_hash = $2, email_verified = true, updated_at = $3
       FROM t WHERE users.id = t.user_id
       RETURNING users.id
     ), signout AS (
       DELETE FROM sessions WHERE user_id IN (SELECT id FROM u)
     )
     SELECT id FROM u`,
    [hashToken(token), passwordHash, now],
  );
  const id = r.rows[0]?.id;
  return id ? findUserById(str(id)) : null;
}

/* ============================== words ============================== */
/*
 * Every word belongs to a course, and two kinds of words live in one table:
 *   owner_id IS NULL  → a shared lesson word: everyone in the course studies it, only its teachers change it
 *   owner_id = <user> → that person's own word: only they see it, study it and change it
 * Teachers write their course's shared words; everyone else writes their own. `owner` below is that value.
 */

/** Which words a write goes to: shared (null) for the course's teachers, their own for everyone else. */
export const ownerFor = (user: { id: string; teacher: boolean }): string | null => (user.teacher ? null : user.id);

/** A course's shared words plus your own words in it (guests: shared only). */
export async function listWords(userId: string | null, courseId: string): Promise<Record<string, Word>> {
  const db = await getDb();
  const r = await db.query('SELECT id, owner_id, data FROM words WHERE course_id = $2 AND (owner_id IS NULL OR owner_id = $1)', [userId, courseId]);
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
 * Create or update one word in a course. 'forbidden': the id belongs to a word you may not change
 * (someone else's, a shared one for a student, or one in another course). 'limit': too many own words.
 */
export async function saveWord(
  owner: string | null, courseId: string, id: string, data: WordData, now = Date.now(),
): Promise<'ok' | 'forbidden' | 'limit'> {
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO words (id, owner_id, course_id, data, updated_at)
     SELECT $1, $2, $6, $3::jsonb, $4
     WHERE $2::text IS NULL OR EXISTS (SELECT 1 FROM words WHERE id = $1) OR (SELECT count(*) FROM words WHERE owner_id = $2) < $5
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
       WHERE words.owner_id IS NOT DISTINCT FROM excluded.owner_id AND words.course_id = excluded.course_id
     RETURNING id`,
    [id, owner, JSON.stringify(data), now, MAX_OWN_WORDS, courseId],
  );
  if (r.rowCount) return 'ok';
  const exists = await db.query('SELECT 1 FROM words WHERE id = $1', [id]);
  return exists.rowCount ? 'forbidden' : 'limit';
}

/** Add many words to a course at once (Import). Ids that belong to someone else are skipped. Returns how many were saved. */
export async function putWords(
  owner: string | null, courseId: string, words: { id: string; data: WordData }[], now = Date.now(),
): Promise<number> {
  if (!words.length) return 0;
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO words (id, owner_id, course_id, data, updated_at)
     SELECT x.id, $2, $4, x.data, $3 FROM jsonb_to_recordset($1::jsonb) AS x(id text, data jsonb)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
       WHERE words.owner_id IS NOT DISTINCT FROM excluded.owner_id AND words.course_id = excluded.course_id`,
    [JSON.stringify(words), owner, now, courseId],
  );
  return r.rowCount;
}

/** Your own words in all courses (the MAX_OWN_WORDS limit is per person). */
export async function countOwnWords(userId: string): Promise<number> {
  const db = await getDb();
  const r = await db.query('SELECT count(*)::int AS n FROM words WHERE owner_id = $1', [userId]);
  return num(r.rows[0]?.n);
}

/** Delete a word you may change. Everyone's progress on it goes too (ON DELETE CASCADE). */
export async function deleteWord(owner: string | null, courseId: string, id: string): Promise<'ok' | 'forbidden'> {
  const db = await getDb();
  const r = await db.query(
    'DELETE FROM words WHERE id = $1 AND owner_id IS NOT DISTINCT FROM $2 AND course_id = $3 RETURNING id',
    [id, owner, courseId],
  );
  if (r.rowCount) return 'ok';
  const exists = await db.query('SELECT 1 FROM words WHERE id = $1', [id]);
  return exists.rowCount ? 'forbidden' : 'ok'; // already gone is fine
}

/* ============================== progress (per person) ============================== */

/** Your progress on a course's words. */
export async function listCards(userId: string, courseId: string): Promise<Record<string, CardDoc>> {
  const db = await getDb();
  const r = await db.query(
    'SELECT c.word_id, c.data FROM cards c JOIN words w ON w.id = c.word_id WHERE c.user_id = $1 AND w.course_id = $2',
    [userId, courseId],
  );
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
  const { answers, newCards, reviews, recalled } = diffActivity(prev, doc);
  // Kept once set (COALESCE): a word stays mastered in the history even if it is forgotten later.
  const mastered = masteredAt(doc) ?? (flags.mature ? now : null);
  try {
    await db.query(
      `WITH card AS (
         INSERT INTO cards (user_id, word_id, data, started, mature, mastered_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5, $10::bigint, $6)
         ON CONFLICT (user_id, word_id) DO UPDATE SET data = excluded.data, started = excluded.started,
           mature = excluded.mature, mastered_at = COALESCE(cards.mastered_at, excluded.mastered_at), updated_at = excluded.updated_at
       )
       INSERT INTO activity (user_id, day, answers, new_cards, reviews, recalled) SELECT $1, $7, $8, $9, $11, $12 WHERE $8::int > 0 OR $9::int > 0
       ON CONFLICT (user_id, day) DO UPDATE SET answers = activity.answers + excluded.answers,
         new_cards = activity.new_cards + excluded.new_cards, reviews = activity.reviews + excluded.reviews,
         recalled = activity.recalled + excluded.recalled`,
      [userId, wordId, JSON.stringify(doc), flags.started, flags.mature, now, todayKey(now), answers, newCards, mastered, reviews, recalled],
    );
  } catch (e) {
    if ((e as { code?: string }).code === FOREIGN_KEY_VIOLATION) return 'no-word'; // deleted a moment ago
    throw e;
  }
  return 'ok';
}

/** Reset your progress in one course. Other courses keep theirs. */
export async function deleteAllCards(userId: string, courseId: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM cards c USING words w WHERE w.id = c.word_id AND c.user_id = $1 AND w.course_id = $2', [userId, courseId]);
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
    let reviews = 0;
    let recalled = 0;
    for (const s of [doc.f, doc.r]) {
      if (!s) continue;
      const todays = s.log.filter((e) => isToday(e.t));
      answers += todays.length;
      for (const e of todays) {
        if (e.k !== 'review') continue;
        reviews++;
        if (isRecalled(e)) recalled++;
      }
      if (s.type !== 'new' && isToday(s.first)) newCards++;
    }
    const flags = cardFlags(doc);
    const mastered = masteredAt(doc) ?? (flags.mature ? now : null);
    return { word_id: wordId, data: doc, ...flags, mastered_at: mastered, answers, new_cards: newCards, reviews, recalled };
  });
  if (!rows.length && prefs === undefined) return 0;
  const db = await getDb();
  const r = await db.query(
    `WITH x AS (
       SELECT * FROM jsonb_to_recordset($2::jsonb)
         AS x(word_id text, data jsonb, started int, mature int, mastered_at bigint, answers int, new_cards int, reviews int, recalled int)
     ), added AS (
       INSERT INTO cards (user_id, word_id, data, started, mature, mastered_at, updated_at)
       SELECT $1, x.word_id, x.data, x.started, x.mature, x.mastered_at, $3
       FROM x JOIN words w ON w.id = x.word_id AND (w.owner_id IS NULL OR w.owner_id = $1)
       ON CONFLICT (user_id, word_id) DO NOTHING
       RETURNING word_id
     ), counted AS (
       INSERT INTO activity (user_id, day, answers, new_cards, reviews, recalled)
       SELECT $1, $4, LEAST(sum(x.answers), 1000), LEAST(sum(x.new_cards), 400), LEAST(sum(x.reviews), 1000), LEAST(sum(x.recalled), 1000)
       FROM x JOIN added ON added.word_id = x.word_id
       HAVING sum(x.answers) > 0 OR sum(x.new_cards) > 0
       ON CONFLICT (user_id, day) DO UPDATE SET answers = activity.answers + excluded.answers,
         new_cards = activity.new_cards + excluded.new_cards, reviews = activity.reviews + excluded.reviews,
         recalled = activity.recalled + excluded.recalled
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

/** Your streak: days in a row with an answer (up to yesterday if you haven't studied yet today). */
export async function myStreak(userId: string, now = Date.now()): Promise<{ days: number; studiedToday: boolean }> {
  const db = await getDb();
  const today = todayKey(now);
  const r = await db.query('SELECT day FROM activity WHERE user_id = $1 AND answers > 0 AND day >= $2', [userId, shiftDay(today, -400)]);
  const days = new Set(r.rows.map((row) => str(row.day)));
  return { days: streakFrom(days, today), studiedToday: days.has(today) };
}

/* ============================== cheers ============================== */

/** Someone on a course's leaderboard (or one of its teachers): the people you can cheer there. */
const ON_COURSE_BOARD = `SELECT 1 FROM course_members m JOIN users u ON u.id = m.user_id
  WHERE m.course_id = $7 AND m.user_id = $3 AND (m.on_board OR m.role = 'teacher' OR u.role = 'admin')`;

/** Cheer a classmate in `courseId` (your active course). One per classmate per day. */
export async function sendCheer(
  fromId: string, toId: string, kind: CheerKind, courseId: string, now = Date.now(),
): Promise<'ok' | 'already' | 'no-user' | 'self'> {
  if (fromId === toId) return 'self';
  const db = await getDb();
  const r = await db.query(
    `WITH sent AS (
       INSERT INTO cheers (id, from_user, to_user, kind, day, created_at)
       SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (${ON_COURSE_BOARD})
       ON CONFLICT (from_user, to_user, day) DO NOTHING RETURNING id
     )
     SELECT (SELECT count(*)::int FROM sent) AS sent, EXISTS (${ON_COURSE_BOARD}) AS listed`,
    [`c_${randomBytes(9).toString('base64url')}`, fromId, toId, kind, todayKey(now), now, courseId],
  );
  const row = r.rows[0];
  if (num(row?.sent)) return 'ok';
  return row?.listed ? 'already' : 'no-user';
}

export async function unseenCheers(userId: string): Promise<Cheer[]> {
  const db = await getDb();
  const r = await db.query(
    `SELECT c.id, c.kind, c.created_at, u.id AS from_id, u.display_name
     FROM cheers c JOIN users u ON u.id = c.from_user
     WHERE c.to_user = $1 AND c.seen_at IS NULL ORDER BY c.created_at DESC LIMIT 20`,
    [userId],
  );
  return r.rows.map((row) => ({
    id: str(row.id),
    kind: str(row.kind) as CheerKind,
    createdAt: num(row.created_at),
    from: { id: str(row.from_id), displayName: str(row.display_name) },
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

/**
 * A course's members with their word counts in it and the last ~13 months of activity: three
 * queries, run in parallel. Activity (answers, streaks) counts all of a person's courses.
 */
async function loadEveryone(now: number, courseId: string) {
  const db = await getDb();
  const since = shiftDay(todayKey(now), -400);
  const [users, cards, acts] = await Promise.all([
    db.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, u.role, m.role AS course_role, m.on_board, m.joined_at,
              u.created_at, u.last_seen_at, u.google_id IS NOT NULL AS has_google, u.password_hash IS NOT NULL AS has_password
       FROM course_members m JOIN users u ON u.id = m.user_id WHERE m.course_id = $1 ORDER BY m.joined_at`,
      [courseId],
    ),
    db.query(
      `SELECT c.user_id, sum(c.started)::int AS active, sum(c.mature)::int AS mature
       FROM cards c JOIN words w ON w.id = c.word_id WHERE w.course_id = $1 GROUP BY c.user_id`,
      [courseId],
    ),
    db.query(
      `SELECT a.user_id, a.day, a.answers, a.visits FROM activity a
       JOIN course_members m ON m.user_id = a.user_id AND m.course_id = $2 WHERE a.day >= $1`,
      [since, courseId],
    ),
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
      email: str(r.email),
      displayName: str(r.display_name),
      avatarUrl: r.avatar_url == null ? null : str(r.avatar_url),
      hasGoogle: r.has_google === true,
      hasPassword: r.has_password === true,
      role: (r.role === 'admin' ? 'admin' : 'student') as Role,
      teacher: r.role === 'admin' || r.course_role === 'teacher',
      inClass: r.on_board !== false,
      createdAt: num(r.created_at),
      joinedAt: num(r.joined_at), // joined this course
      lastSeenAt: r.last_seen_at == null ? null : num(r.last_seen_at),
      ...(counts.get(str(r.id)) ?? { active: 0, mature: 0 }),
      act: activity.get(str(r.id)) ?? empty,
    })),
  };
}

const sumDays = (a: PersonActivity, days: string[]) => days.reduce((n, d) => n + (a.answersByDay.get(d) ?? 0), 0);

/**
 * Everyone on a course's leaderboard, with the numbers the Class tab shows. No email addresses:
 * classmates never see them.
 */
export async function classOverview(viewerId: string, courseId: string, now = Date.now()): Promise<ClassData> {
  const today = todayKey(now);
  const week = lastDays(today, 7);
  const db = await getDb();
  const [{ users }, cheers] = await Promise.all([
    loadEveryone(now, courseId),
    db.query('SELECT to_user FROM cheers WHERE from_user = $1 AND day = $2', [viewerId, today]),
  ]);
  const cheered = new Set(cheers.rows.map((r) => str(r.to_user)));
  const members: ClassMember[] = users.filter((u) => u.teacher || u.inClass).map((u) => ({
    id: u.id,
    displayName: u.displayName,
    role: u.teacher ? 'admin' : 'student',
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
    profiles: number; // members of the course
    admins: number; // its teachers (admins teach every course)
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
    email: string; // '' for profiles from before sign-in by email
    displayName: string;
    avatarUrl: string | null;
    hasGoogle: boolean;
    hasPassword: boolean;
    role: Role; // 'admin': runs the whole app
    teacher: boolean; // teaches this course (admins too)
    inClass: boolean; // on this course's leaderboard
    createdAt: number;
    joinedDay: string; // joined this course: 'YYYY-MM-DD' in the center's time zone
    lastSeenAt: number | null;
    streak: number;
    activeWords: number;
    matureWords: number;
    answersWeek: number;
    studiedToday: boolean;
  }[];
  classLesson: string | null; // the lesson the class is on
  decks: { deck: string; words: number }[]; // the shared decks, for picking it
}

/** /admin for one course: its members, their activity and its lesson. */
export async function adminStats(courseId: string, now = Date.now()): Promise<AdminStats> {
  const today = todayKey(now);
  const days = lastDays(today, 30);
  const week = lastDays(today, 7);
  const [{ users }, classLesson, decks] = await Promise.all([loadEveryone(now, courseId), getClassLesson(courseId), sharedDecks(courseId)]);
  const studiedOn = (day: string) => users.filter((u) => u.act.studyDays.has(day)).length;
  const studiedIn = (range: string[]) => users.filter((u) => range.some((d) => u.act.studyDays.has(d))).length;
  const createdDay = (u: (typeof users)[number]) => dayKey(u.joinedAt, TIMEZONE);
  return {
    today,
    timeZone: TIMEZONE,
    totals: {
      profiles: users.length,
      admins: users.filter((u) => u.teacher).length,
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
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        hasGoogle: u.hasGoogle,
        hasPassword: u.hasPassword,
        role: u.role,
        teacher: u.teacher,
        inClass: u.inClass,
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
    classLesson,
    decks,
  };
}

/** A course's students: members who neither teach it nor run the app. Uses $1 for the course. */
const STUDENTS = `SELECT m.user_id, m.joined_at, m.on_board FROM course_members m JOIN users u ON u.id = m.user_id
  WHERE m.course_id = $1 AND m.role = 'student' AND u.role = 'student'`;

/**
 * Everything /admin/analytics shows for one course (see lib/analytics.ts for the definitions).
 * Six small queries in parallel, each served by an index; the arithmetic happens in computeAnalytics().
 */
export async function analytics(period: Period, courseId: string, now = Date.now()): Promise<Analytics> {
  const db = await getDb();
  const today = todayKey(now);
  // Far enough back for the weekly charts, the retention cohorts and the funnel's period
  const charts = shiftDay(today, -Math.max(7 * WEEKS, 7 * COHORTS));
  const since = period === 'all' ? '' : [charts, shiftDay(today, -Number(period))].sort()[0];
  const masteredSince = now - (7 * WEEKS + 2) * DAY;
  const [students, study, mastered, cheers, visitors, totals] = await Promise.all([
    db.query(STUDENTS, [courseId]),
    db.query(
      `SELECT a.user_id, a.day, a.answers, a.new_cards, a.reviews, a.recalled
       FROM activity a JOIN (${STUDENTS}) s ON s.user_id = a.user_id
       WHERE a.answers > 0 AND a.day >= $2`,
      [courseId, since],
    ),
    db.query(
      `SELECT c.user_id, c.mastered_at FROM cards c JOIN (${STUDENTS}) s ON s.user_id = c.user_id
       JOIN words w ON w.id = c.word_id AND w.course_id = $1
       WHERE c.mastered_at >= $2`,
      [courseId, masteredSince],
    ),
    db.query(`SELECT c.day FROM cheers c JOIN (${STUDENTS}) s ON s.user_id = c.from_user WHERE c.day >= $2`, [courseId, charts]),
    db.query('SELECT first_day, last_day, tried_day, joined_day FROM visitors WHERE course_id = $1 AND (first_day >= $2 OR last_day >= $3)', [
      courseId,
      since,
      shiftDay(today, -6),
    ]),
    db.query(
      `SELECT (SELECT count(*)::int FROM cards c JOIN (${STUDENTS}) s ON s.user_id = c.user_id
               JOIN words w ON w.id = c.word_id AND w.course_id = $1
               WHERE c.mastered_at IS NOT NULL) AS mastered,
              (SELECT min(first_day) FROM visitors WHERE course_id = $1) AS visitors_since`,
      [courseId],
    ),
  ]);
  const t = totals.rows[0] ?? {};
  return computeAnalytics(
    {
      today,
      students: students.rows.map((r) => ({ id: str(r.user_id), joinedDay: dayKey(num(r.joined_at), TIMEZONE), inClass: r.on_board !== false })),
      study: study.rows.map((r) => ({
        userId: str(r.user_id),
        day: str(r.day),
        answers: num(r.answers),
        newCards: num(r.new_cards),
        reviews: num(r.reviews),
        recalled: num(r.recalled),
      })),
      mastered: mastered.rows.map((r) => ({ userId: str(r.user_id), day: dayKey(num(r.mastered_at), TIMEZONE) })),
      masteredTotal: num(t.mastered),
      cheerDays: cheers.rows.map((r) => str(r.day)),
      visitors: visitors.rows.map((r) => ({
        firstDay: str(r.first_day),
        lastDay: str(r.last_day),
        triedDay: r.tried_day == null ? null : str(r.tried_day),
        joinedDay: r.joined_day == null ? null : str(r.joined_day),
      })),
      visitorsSince: t.visitors_since == null ? null : str(t.visitors_since),
    },
    period,
  );
}

/* ============================== the class's lesson ============================== */

/** The lesson a course's class is on ("Lektion 10"), set by a teacher in /admin. Null: not set (book order). */
export async function getClassLesson(courseId: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.query('SELECT current_lesson FROM courses WHERE id = $1', [courseId]);
  return r.rows[0]?.current_lesson ? str(r.rows[0].current_lesson) : null;
}

/** Set it to one of the course's shared decks, or clear it (null). False when none of its shared words has that deck. */
export async function setClassLesson(courseId: string, deck: string | null): Promise<boolean> {
  const db = await getDb();
  const r = await db.query(
    `UPDATE courses SET current_lesson = $2::text WHERE id = $1 AND ($2::text IS NULL OR EXISTS (
       SELECT 1 FROM words WHERE owner_id IS NULL AND course_id = $1 AND data->>'deck' = $2::text
     )) RETURNING id`,
    [courseId, deck],
  );
  return r.rowCount > 0;
}

/** A course's shared decks with their word counts, for the teacher's lesson picker. */
export async function sharedDecks(courseId: string): Promise<{ deck: string; words: number }[]> {
  const db = await getDb();
  const r = await db.query(
    `SELECT data->>'deck' AS deck, count(*)::int AS n FROM words
     WHERE course_id = $1 AND owner_id IS NULL AND coalesce(data->>'deck', '') <> '' GROUP BY 1`,
    [courseId],
  );
  const collator = new Intl.Collator('de', { numeric: true });
  return r.rows.map((row) => ({ deck: str(row.deck), words: num(row.n) })).sort((a, b) => collator.compare(a.deck, b.deck));
}
