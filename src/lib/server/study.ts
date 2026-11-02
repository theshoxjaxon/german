/**
 * "Let's study together": sign-ups, the Sunday matching, groups, their private chats, blocks,
 * reports and the teachers' speaking clubs.
 *
 * Privacy rules, kept by every query here:
 *  - a group's messages and members are read only through a membership check in the same SQL
 *    (`me.user_id = <you> AND me.left_at IS NULL`); there is no query that reads a chat for a
 *    teacher or an admin
 *  - members are shown as a name and a per-group key, never a user id or an email
 *  - reports keep who, whom and a reason, never the messages
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Course, TargetLang } from '../courses';
import { makeGroups } from '../study/match';
import type { ReportReason, StudyAdminView, StudyClub, StudyGroupView, StudyMember, StudyMessage, StudyState, StudyTask } from '../study/types';
import { dueWeek, isSlot, KEEP_AFTER_WEEK, signupWeek, weekEnd, weekOf, deadline } from '../study/week';
import { shiftDay } from '../stats';
import { DAY, HOUR } from '../time';
import { getDb } from './db';
import { TIMEZONE, type UserRow } from './repo';
import { TESTS } from './tests';

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));
const nums = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []);

/** Students on the class board; teachers plan speaking clubs instead of joining groups. */
export const canStudy = (u: Pick<UserRow, 'member' | 'inClass' | 'teacher'>) => u.member && u.inClass && !u.teacher;

/** What the other members see instead of a user id: stable in the group, useless outside it. */
export const memberKey = (groupId: string, userId: string) => createHash('sha256').update(`${groupId}:${userId}`).digest('base64url').slice(0, 12);

/** A list of free hours as sent by the browser: known slots only, each once, sorted. */
export function cleanSlots(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length > 7 * 24) return null;
  if (!raw.every(isSlot)) return null;
  return [...new Set(raw as number[])].sort((a, b) => a - b);
}

/* ---------- speaking tasks for the groups ---------- */

const ENGLISH_TASKS: StudyTask[] = [
  { prompt: 'Topic: free time. Ask each other a question with each card, then answer.', cards: ['weekend', 'sport', 'music'] },
  { prompt: 'Topic: family and home. Ask each other a question with each card, then answer.', cards: ['brothers and sisters', 'your room', 'neighbours'] },
  { prompt: 'Topic: food. Ask each other a question with each card, then answer.', cards: ['breakfast', 'favourite dish', 'restaurant'] },
  { prompt: 'Topic: travel. Ask each other a question with each card, then answer.', cards: ['last holiday', 'dream trip', 'transport'] },
  { prompt: 'Topic: work and study. Ask each other a question with each card, then answer.', cards: ['your day', 'future job', 'homework'] },
  { prompt: 'Topic: plans. Make a plan together for the weekend: where, when, what.', cards: ['place', 'time', 'activity'] },
];

/** The speaking cards of the mock tests, for courses in that language; a short list otherwise. */
function tasksFor(lang: TargetLang): StudyTask[] {
  const fromTests = TESTS.filter((t) => t.course === 'german' && lang === 'de')
    .flatMap((t) => t.sections.flatMap((s) => s.tasks.flatMap((tk) => tk.items)))
    .flatMap((it) => (it.type === 'speaking' && it.part > 1 ? [{ prompt: it.prompt, cards: it.cards }] : []));
  return fromTests.length ? fromTests : ENGLISH_TASKS;
}

/* ---------- sign-ups ---------- */

export async function getSignup(userId: string, courseId: string, week: string): Promise<number[] | null> {
  const db = await getDb();
  const r = await db.query('SELECT slots FROM study_signups WHERE course_id = $1 AND week = $2 AND user_id = $3', [courseId, week, userId]);
  return r.rows[0] ? nums(r.rows[0].slots) : null;
}

export async function saveSignup(userId: string, courseId: string, week: string, slots: number[], now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO study_signups (course_id, week, user_id, slots, updated_at) VALUES ($1, $2, $3, $4::smallint[], $5)
     ON CONFLICT (course_id, week, user_id) DO UPDATE SET slots = excluded.slots, updated_at = excluded.updated_at`,
    [courseId, week, userId, slots, now],
  );
}

export async function removeSignup(userId: string, courseId: string, week: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM study_signups WHERE course_id = $1 AND week = $2 AND user_id = $3', [courseId, week, userId]);
}

/* ---------- matching ---------- */

/**
 * Make the groups of `week` in `course`, once. Runs from the Sunday cron job and, if that hasn't
 * happened, from the first visit after the deadline. The claim and every group and member are
 * written in one statement, so two runs at the same moment can't both write, and a failure
 * leaves nothing half done. Returns how many groups were made (null: already done).
 */
export async function runMatching(course: Pick<Course, 'id' | 'targetLang'>, week: string, now = Date.now(), random = Math.random): Promise<number | null> {
  const db = await getDb();
  const done = await db.query('SELECT 1 FROM study_runs WHERE course_id = $1 AND week = $2', [course.id, week]);
  if (done.rows.length) return null;

  // Sign-ups of people who may still study in this course (a teacher may have taken someone off the board)
  const signups = await db.query(
    `SELECT s.user_id, s.slots FROM study_signups s
     JOIN course_members m ON m.course_id = s.course_id AND m.user_id = s.user_id AND m.role = 'student' AND m.on_board
     JOIN users u ON u.id = s.user_id AND u.role <> 'admin'
     WHERE s.course_id = $1 AND s.week = $2`,
    [course.id, week],
  );
  const people = signups.rows.map((r) => ({ userId: str(r.user_id), slots: nums(r.slots).filter(isSlot) }));
  const ids = people.map((p) => p.userId);
  const blocks = ids.length
    ? await db.query('SELECT user_id, blocked_id FROM study_blocks WHERE user_id = ANY($1) AND blocked_id = ANY($1)', [ids])
    : { rows: [] };
  const blocked = new Set(blocks.rows.map((r) => `${str(r.user_id)} ${str(r.blocked_id)}`));
  const { groups } = makeGroups(people, (a, b) => blocked.has(`${a} ${b}`), random);

  const tasks = tasksFor(course.targetLang);
  const ends = weekEnd(week, TIMEZONE);
  const groupRows = groups.map((g) => ({
    id: `g_${randomBytes(16).toString('base64url')}`,
    slot: g.slots[0] ?? null,
    slots: g.slots,
    task: tasks[Math.floor(random() * tasks.length)],
    members: g.members,
  }));
  const memberRows = groupRows.flatMap((g) => g.members.map((userId) => ({ group_id: g.id, user_id: userId, member_key: memberKey(g.id, userId) })));
  const r = await db.query(
    `WITH claim AS (
       INSERT INTO study_runs (course_id, week, ran_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1
     ), g AS (
       INSERT INTO study_groups (id, course_id, week, slot, slots, task, created_at, ends_at, expires_at)
       SELECT x.id, $1, $2, x.slot, ARRAY(SELECT jsonb_array_elements_text(x.slots)::smallint), x.task, $3, $4, $5
       FROM jsonb_to_recordset($6::jsonb) AS x (id text, slot smallint, slots jsonb, task jsonb)
       WHERE EXISTS (SELECT 1 FROM claim)
       RETURNING id
     ), m AS (
       INSERT INTO study_members (group_id, user_id, member_key)
       SELECT y.group_id, y.user_id, y.member_key
       FROM jsonb_to_recordset($7::jsonb) AS y (group_id text, user_id text, member_key text)
       WHERE EXISTS (SELECT 1 FROM claim) AND y.group_id IN (SELECT id FROM g)
     )
     SELECT count(*)::int AS claimed FROM claim`,
    [course.id, week, now, ends, ends + KEEP_AFTER_WEEK, JSON.stringify(groupRows.map((g) => ({ id: g.id, slot: g.slot, slots: g.slots, task: g.task }))), JSON.stringify(memberRows)],
  );
  return num(r.rows[0]?.claimed) ? groupRows.length : null;
}

/** The groups due now, for one course (the lazy run) or every course with sign-ups (the cron job). */
export async function matchDue(courses: Pick<Course, 'id' | 'targetLang'>[], now = Date.now()): Promise<number> {
  const week = dueWeek(now, TIMEZONE);
  let made = 0;
  for (const c of courses) made += (await runMatching(c, week, now)) ?? 0;
  return made;
}

/** Courses with sign-ups for the week now due, so the cron job only visits those. */
export async function coursesToMatch(now = Date.now()): Promise<Pick<Course, 'id' | 'targetLang'>[]> {
  const db = await getDb();
  const r = await db.query(
    `SELECT DISTINCT c.id, c.target_lang FROM study_signups s JOIN courses c ON c.id = s.course_id
     WHERE s.week = $1 AND NOT EXISTS (SELECT 1 FROM study_runs r WHERE r.course_id = s.course_id AND r.week = s.week)`,
    [dueWeek(now, TIMEZONE)],
  );
  return r.rows.map((row) => ({ id: str(row.id), targetLang: str(row.target_lang) === 'en' ? 'en' : 'de' }));
}

/** Delete what is past keeping: groups (with members and messages) 14 days after their week, old sign-ups, clubs and reports. */
export async function purgeStudy(now = Date.now()): Promise<void> {
  const db = await getDb();
  const oldWeek = shiftDay(weekOf(now, TIMEZONE), -28);
  await db.query(
    `WITH g AS (DELETE FROM study_groups WHERE expires_at <= $1),
     s AS (DELETE FROM study_signups WHERE week < $2),
     r AS (DELETE FROM study_runs WHERE week < $2),
     c AS (DELETE FROM study_clubs WHERE starts_at < $3)
     DELETE FROM study_reports WHERE created_at < $4`,
    [now, oldWeek, now - 30 * DAY, now - 180 * DAY],
  );
}

/* ---------- what a student sees ---------- */

async function myGroups(userId: string, courseId: string, now: number): Promise<StudyGroupView[]> {
  const db = await getDb();
  const g = await db.query(
    `SELECT g.id, g.week, g.slot, g.slots, g.task, g.ends_at, g.expires_at,
       (SELECT count(*)::int FROM study_messages x WHERE x.group_id = g.id AND x.id > me.last_read_id AND x.user_id <> $1) AS unread
     FROM study_members me JOIN study_groups g ON g.id = me.group_id
     WHERE me.user_id = $1 AND me.left_at IS NULL AND g.course_id = $2 AND g.expires_at > $3
     ORDER BY g.week DESC`,
    [userId, courseId, now],
  );
  if (!g.rows.length) return [];
  const m = await db.query(
    `SELECT m.group_id, m.member_key, m.left_at, m.user_id = $1 AS me, u.display_name, u.avatar_url
     FROM study_members m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = ANY($2) ORDER BY u.display_name`,
    [userId, g.rows.map((r) => str(r.id))],
  );
  return g.rows.map((r) => ({
    id: str(r.id),
    week: str(r.week),
    slot: r.slot == null ? null : num(r.slot),
    slots: nums(r.slots),
    task: r.task as StudyTask,
    members: m.rows
      .filter((x) => str(x.group_id) === str(r.id))
      .map((x): StudyMember => ({ key: str(x.member_key), name: str(x.display_name), avatarUrl: x.avatar_url == null ? null : str(x.avatar_url), me: x.me === true, left: x.left_at != null })),
    unread: num(r.unread),
    open: num(r.ends_at) > now,
    deleteAt: num(r.expires_at),
  }));
}

export async function upcomingClubs(courseId: string, userId: string | null, now = Date.now()): Promise<StudyClub[]> {
  const db = await getDb();
  const r = await db.query(
    `SELECT c.id, c.starts_at, c.place, count(r.user_id)::int AS going, coalesce(bool_or(r.user_id = $2), false) AS me
     FROM study_clubs c LEFT JOIN study_club_rsvps r ON r.club_id = c.id
     WHERE c.course_id = $1 AND c.starts_at > $3
     GROUP BY c.id ORDER BY c.starts_at LIMIT 20`,
    [courseId, userId ?? '', now - 2 * HOUR],
  );
  return r.rows.map((row) => ({ id: str(row.id), startsAt: num(row.starts_at), place: str(row.place), going: num(row.going), me: row.me === true }));
}

export async function studyState(user: UserRow, now = Date.now()): Promise<StudyState> {
  const week = signupWeek(now, TIMEZONE);
  const due = dueWeek(now, TIMEZONE);
  const db = await getDb();
  const [slots, groups, clubs, last] = await Promise.all([
    getSignup(user.id, user.courseId, week),
    myGroups(user.id, user.courseId, now),
    upcomingClubs(user.courseId, user.id, now),
    // Signed up for the week just matched, but in no group of it (left ones count as had)
    db.query(
      `SELECT 1 FROM study_signups s JOIN study_runs r ON r.course_id = s.course_id AND r.week = s.week
       WHERE s.course_id = $1 AND s.week = $2 AND s.user_id = $3
         AND NOT EXISTS (SELECT 1 FROM study_members m JOIN study_groups g ON g.id = m.group_id
                         WHERE m.user_id = $3 AND g.course_id = $1 AND g.week = $2)`,
      [user.courseId, due, user.id],
    ),
  ]);
  return { timeZone: TIMEZONE, eligible: canStudy(user), week, deadline: deadline(week, TIMEZONE), slots, groups, noGroup: last.rows.length ? due : null, clubs };
}

/* ---------- inside a group: always "you, as a current member" ---------- */

/** The group, if `userId` is in it now (else null: the routes answer 404). */
export async function memberGroup(groupId: string, userId: string, now = Date.now()): Promise<{ id: string; courseId: string; open: boolean } | null> {
  const db = await getDb();
  const r = await db.query(
    `SELECT g.id, g.course_id, g.ends_at FROM study_groups g
     JOIN study_members me ON me.group_id = g.id AND me.user_id = $2 AND me.left_at IS NULL
     WHERE g.id = $1 AND g.expires_at > $3`,
    [groupId, userId, now],
  );
  return r.rows[0] ? { id: str(r.rows[0].id), courseId: str(r.rows[0].course_id), open: num(r.rows[0].ends_at) > now } : null;
}

/** Messages after `after` (the latest 200), read as a member, and marked read. */
export async function listMessages(groupId: string, userId: string, after: number, now = Date.now()): Promise<StudyMessage[] | null> {
  if (!(await memberGroup(groupId, userId, now))) return null;
  const db = await getDb();
  const r = await db.query(
    `SELECT x.id, x.body, x.created_at, a.member_key, x.user_id = $2 AS mine
     FROM study_messages x
     JOIN study_members a ON a.group_id = x.group_id AND a.user_id = x.user_id
     WHERE x.group_id = $1 AND x.id > $3
       AND EXISTS (SELECT 1 FROM study_members me WHERE me.group_id = $1 AND me.user_id = $2 AND me.left_at IS NULL)
     ORDER BY x.id DESC LIMIT 200`,
    [groupId, userId, after],
  );
  const list = r.rows.reverse().map((row) => ({ id: num(row.id), key: str(row.member_key), body: str(row.body), at: num(row.created_at), mine: row.mine === true }));
  if (list.length) {
    await db.query('UPDATE study_members SET last_read_id = GREATEST(last_read_id, $3) WHERE group_id = $1 AND user_id = $2', [groupId, userId, list[list.length - 1].id]);
  }
  return list;
}

/** Post as a current member of a group whose week isn't over; null if not allowed. */
export async function addMessage(groupId: string, userId: string, body: string, now = Date.now()): Promise<StudyMessage | null> {
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO study_messages (group_id, user_id, body, created_at)
     SELECT $1, $2, $3, $4 FROM study_members me JOIN study_groups g ON g.id = me.group_id
     WHERE me.group_id = $1 AND me.user_id = $2 AND me.left_at IS NULL AND g.ends_at > $4
     RETURNING id`,
    [groupId, userId, body, now],
  );
  if (!r.rows[0]) return null;
  return { id: num(r.rows[0].id), key: memberKey(groupId, userId), body, at: now, mine: true };
}

export async function leaveGroup(groupId: string, userId: string, now = Date.now()): Promise<boolean> {
  const db = await getDb();
  const r = await db.query('UPDATE study_members SET left_at = $3 WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL RETURNING 1', [groupId, userId, now]);
  return r.rows.length > 0;
}

/** Block another member of your group (by their member key), so you are never grouped again. */
export async function blockMember(groupId: string, userId: string, key: string, now = Date.now()): Promise<boolean> {
  const db = await getDb();
  const r = await db.query(
    `WITH t AS (
       SELECT t.user_id FROM study_members me
       JOIN study_members t ON t.group_id = me.group_id AND t.member_key = $3 AND t.user_id <> $2
       WHERE me.group_id = $1 AND me.user_id = $2 AND me.left_at IS NULL
     ), b AS (
       INSERT INTO study_blocks (user_id, blocked_id, created_at) SELECT $2, t.user_id, $4 FROM t ON CONFLICT DO NOTHING
     )
     SELECT count(*)::int AS n FROM t`,
    [groupId, userId, key, now],
  );
  return num(r.rows[0]?.n) > 0;
}

/** Report another member (and block them): who, whom and why are kept; not a word of the chat. */
export async function reportMember(groupId: string, userId: string, key: string, reason: ReportReason, now = Date.now()): Promise<boolean> {
  const db = await getDb();
  const r = await db.query(
    `WITH t AS (
       SELECT t.user_id, g.course_id FROM study_members me
       JOIN study_members t ON t.group_id = me.group_id AND t.member_key = $3 AND t.user_id <> $2
       JOIN study_groups g ON g.id = me.group_id
       WHERE me.group_id = $1 AND me.user_id = $2 AND me.left_at IS NULL
     ), rep AS (
       INSERT INTO study_reports (id, course_id, reporter_id, reported_id, reason, created_at)
       SELECT $5, t.course_id, $2, t.user_id, $4, $6 FROM t
     ), b AS (
       INSERT INTO study_blocks (user_id, blocked_id, created_at) SELECT $2, t.user_id, $6 FROM t ON CONFLICT DO NOTHING
     )
     SELECT count(*)::int AS n FROM t`,
    [groupId, userId, key, reason, `r_${randomBytes(9).toString('base64url')}`, now],
  );
  return num(r.rows[0]?.n) > 0;
}

/* ---------- speaking clubs ---------- */

/** Say you'll come (or not) to a club of your course that hasn't started more than 2 hours ago. */
export async function rsvpClub(clubId: string, userId: string, courseId: string, going: boolean, now = Date.now()): Promise<boolean> {
  const db = await getDb();
  const club = await db.query('SELECT 1 FROM study_clubs WHERE id = $1 AND course_id = $2 AND starts_at > $3', [clubId, courseId, now - 2 * HOUR]);
  if (!club.rows.length) return false;
  await db.query(
    going
      ? 'INSERT INTO study_club_rsvps (club_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING'
      : 'DELETE FROM study_club_rsvps WHERE club_id = $1 AND user_id = $2',
    [clubId, userId],
  );
  return true;
}

export async function createClub(courseId: string, startsAt: number, place: string, by: string, now = Date.now()): Promise<string> {
  const db = await getDb();
  const id = `k_${randomBytes(9).toString('base64url')}`;
  await db.query('INSERT INTO study_clubs (id, course_id, starts_at, place, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [id, courseId, startsAt, place, by, now]);
  return id;
}

export async function deleteClub(courseId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.query('DELETE FROM study_clubs WHERE id = $1 AND course_id = $2 RETURNING 1', [id, courseId]);
  return r.rows.length > 0;
}

/* ---------- what a teacher sees: counts and reports, never a chat ---------- */

export async function studyAdmin(courseId: string, now = Date.now()): Promise<StudyAdminView> {
  const db = await getDb();
  const week = signupWeek(now, TIMEZONE);
  const current = weekOf(now, TIMEZONE);
  const eligible = `JOIN course_members m ON m.course_id = s.course_id AND m.user_id = s.user_id AND m.role = 'student' AND m.on_board`;
  const [heat, signups, groups, clubs, reports] = await Promise.all([
    db.query(`SELECT x.slot, count(*)::int AS n FROM study_signups s ${eligible}, unnest(s.slots) AS x (slot) WHERE s.course_id = $1 AND s.week = $2 GROUP BY x.slot`, [courseId, week]),
    db.query(`SELECT s.week, count(*)::int AS n FROM study_signups s ${eligible} WHERE s.course_id = $1 AND s.week = ANY($2) GROUP BY s.week`, [courseId, [week, current]]),
    db.query(
      `SELECT count(DISTINCT g.id)::int AS groups, count(m.user_id)::int AS grouped FROM study_groups g LEFT JOIN study_members m ON m.group_id = g.id
       WHERE g.course_id = $1 AND g.week = $2`,
      [courseId, current],
    ),
    upcomingClubs(courseId, null, now),
    db.query(
      `SELECT r.id, r.created_at, r.reason, a.display_name AS reporter, b.display_name AS reported
       FROM study_reports r JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.reported_id
       WHERE r.course_id = $1 ORDER BY r.created_at DESC LIMIT 100`,
      [courseId],
    ),
  ]);
  const count = (w: string) => num(signups.rows.find((r) => str(r.week) === w)?.n);
  return {
    timeZone: TIMEZONE,
    week,
    deadline: deadline(week, TIMEZONE),
    heat: Object.fromEntries(heat.rows.map((r) => [num(r.slot), num(r.n)])),
    signups: count(week),
    thisWeek: { week: current, signups: count(current), groups: num(groups.rows[0]?.groups), grouped: num(groups.rows[0]?.grouped) },
    clubs,
    reports: reports.rows.map((r) => ({ id: str(r.id), at: num(r.created_at), reporter: str(r.reporter), reported: str(r.reported), reason: str(r.reason) as ReportReason })),
  };
}
