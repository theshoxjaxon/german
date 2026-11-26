import { Injectable } from '@nestjs/common';
import type { AdminStats } from '@/lib/admin-types';
import { COHORTS, computeAnalytics, WEEKS, type Analytics, type Period } from '@/lib/analytics';
import { dayKey, lastDays, shiftDay, streakFrom } from '@/lib/stats';
import { type ClassData, type ClassMember, type Role } from '@/lib/types';
import { DAY } from '@/lib/time';
import { Database, type Db } from '@api/database/database.service';
import { str, num, TIMEZONE, todayKey } from '@api/common/db-util';
import { CoursesRepository } from '@api/courses/courses.repository';

interface PersonActivity {
  studyDays: Set<string>;
  answersByDay: Map<string, number>;
  visitDays: Set<string>;
}

/**
 * A course's members with their word counts in it and the last ~13 months of activity: three
 * queries, run in parallel. Activity (answers, streaks) counts all of a person's courses.
 */
async function loadEveryone(db: Db, now: number, courseId: string) {
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
 * One classmate's numbers, as the Class tab and the dashboard need them. Much lighter than
 * loadEveryone() (which the teachers' dashboard uses): only the people on the leaderboard, only
 * their study days, and only the last 45 days unless a streak reaches back further.
 */
interface ClassRow { id: string; displayName: string; teacher: boolean; active: number; mature: number; days: Set<string>; answers: Map<string, number> }

const CLASS_WINDOW = 45;

async function loadClassRows(db: Db, courseId: string, today: string): Promise<ClassRow[]> {
  const since = shiftDay(today, -(CLASS_WINDOW - 1));
  const [people, cards, acts] = await Promise.all([
    db.query(
      `SELECT u.id, u.display_name, (u.role = 'admin' OR m.role = 'teacher') AS teacher
       FROM course_members m JOIN users u ON u.id = m.user_id
       WHERE m.course_id = $1 AND (m.on_board IS NOT FALSE OR m.role = 'teacher' OR u.role = 'admin') ORDER BY m.joined_at`,
      [courseId],
    ),
    db.query(
      `SELECT c.user_id, sum(c.started)::int AS active, sum(c.mature)::int AS mature
       FROM cards c JOIN words w ON w.id = c.word_id WHERE w.course_id = $1 GROUP BY c.user_id`,
      [courseId],
    ),
    db.query(
      `SELECT a.user_id, a.day, a.answers FROM activity a
       JOIN course_members m ON m.user_id = a.user_id AND m.course_id = $2 WHERE a.day >= $1 AND a.answers > 0`,
      [since, courseId],
    ),
  ]);
  const rows = new Map<string, ClassRow>();
  for (const r of people.rows) rows.set(str(r.id), { id: str(r.id), displayName: str(r.display_name), teacher: r.teacher === true, active: 0, mature: 0, days: new Set(), answers: new Map() });
  for (const r of cards.rows) {
    const row = rows.get(str(r.user_id));
    if (row) { row.active = num(r.active); row.mature = num(r.mature); }
  }
  for (const r of acts.rows) {
    const row = rows.get(str(r.user_id));
    if (row) { row.days.add(str(r.day)); row.answers.set(str(r.day), num(r.answers)); }
  }
  // A streak that reaches the start of the window may go on: look further back for those people only.
  const long = [...rows.values()].filter((r) => r.days.has(since)).map((r) => r.id);
  if (long.length) {
    const older = await db.query('SELECT user_id, day FROM activity WHERE user_id = ANY($1) AND day < $2 AND day >= $3 AND answers > 0', [long, since, shiftDay(today, -400)]);
    for (const r of older.rows) rows.get(str(r.user_id))?.days.add(str(r.day));
  }
  return [...rows.values()];
}

export type { AdminStats };

/** A course's students: members who neither teach it nor run the app. Uses $1 for the course. */
const STUDENTS = `SELECT m.user_id, m.joined_at, m.on_board FROM course_members m JOIN users u ON u.id = m.user_id
  WHERE m.course_id = $1 AND m.role = 'student' AND u.role = 'student'`;

@Injectable()
export class ClassroomRepository {
  constructor(
    private readonly database: Database,
    private readonly coursesRepo: CoursesRepository,
  ) {}

  /**
   * Everyone on a course's leaderboard, with the numbers the Class tab shows. No email addresses:
   * classmates never see them.
   */
  async classOverview(viewerId: string, courseId: string, now = Date.now()): Promise<ClassData> {
    const today = todayKey(now);
    const week = lastDays(today, 7);
    const db = await this.database.get();
    const [rows, cheers] = await Promise.all([loadClassRows(db, courseId, today), db.query('SELECT to_user FROM cheers WHERE from_user = $1 AND day = $2', [viewerId, today])]);
    const cheered = new Set(cheers.rows.map((r) => str(r.to_user)));
    const members: ClassMember[] = rows.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.teacher ? 'admin' : 'student',
      activeWords: u.active,
      matureWords: u.mature,
      streak: streakFrom(u.days, today),
      studiedToday: u.days.has(today),
      answersToday: u.answers.get(today) ?? 0,
      answersWeek: week.reduce((n, d) => n + (u.answers.get(d) ?? 0), 0),
      cheeredToday: cheered.has(u.id),
      isMe: u.id === viewerId,
    }));
    return { today, members };
  }

  /**
   * /admin for one course: its members, their activity and its lesson. Email addresses only with
   * `emails` (for admins): a course's teachers see names, like everyone else.
   */
  async adminStats(courseId: string, emails = false, now = Date.now()): Promise<AdminStats> {
    const today = todayKey(now);
    const days = lastDays(today, 30);
    const week = lastDays(today, 7);
    const [{ users }, classLesson, decks] = await Promise.all([loadEveryone(await this.database.get(), now, courseId), this.coursesRepo.getClassLesson(courseId), this.coursesRepo.sharedDecks(courseId)]);
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
          email: emails ? u.email : '',
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

  /**
   * Everything /admin/analytics shows for one course (see lib/analytics.ts for the definitions).
   * Six small queries in parallel, each served by an index; the arithmetic happens in computeAnalytics().
   */
  async analytics(period: Period, courseId: string, now = Date.now()): Promise<Analytics> {
    const db = await this.database.get();
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
}
