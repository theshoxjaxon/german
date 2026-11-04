'use server';

/**
 * Server Actions for /admin. Each one checks the signed-in user's rights itself: a Server
 * Action is a public endpoint, so hiding a button is never enough.
 *
 *   admins (ADMIN_EMAILS)   everything: passwords, roles, deleting profiles, courses, teachers
 *   a course's teachers     that course: its leaderboard, its lesson, its name and note
 */
import { refresh } from 'next/cache';
import { isCourseId, isTargetLang, RESERVED_COURSE_IDS } from '@/lib/courses';
import { hashPassword, temporaryPassword } from '@/lib/server/password';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';
import { createClub, deleteClub } from '@/lib/server/study';
import type { Role } from '@/lib/types';

type Result = { ok: true; password?: string } | { ok: false; error: string };

async function requireAdmin() {
  const user = await currentUser();
  return user?.role === 'admin' ? user : null;
}
/** An admin, or a teacher of this course. */
async function requireTeacher(courseId: unknown) {
  const user = await currentUser();
  if (!user || typeof courseId !== 'string') return null;
  if (user.role === 'admin') return user;
  return (await repo.membership(courseId, user.id))?.role === 'teacher' ? user : null;
}
const denied: Result = { ok: false, error: 'Only admins can do this. Sign in again as an admin.' };
const notTeacher: Result = { ok: false, error: 'Only this course’s teachers can do this.' };
const gone: Result = { ok: false, error: 'That profile no longer exists.' };

/** Set a new temporary password and sign the student out everywhere. */
export async function resetPasswordAction(userId: string): Promise<Result> {
  if (!(await requireAdmin())) return denied;
  if (typeof userId !== 'string' || !(await repo.findUserById(userId))) return gone;
  const password = temporaryPassword();
  await repo.setPasswordHash(userId, await hashPassword(password));
  await repo.deleteUserSessions(userId);
  return { ok: true, password };
}

export async function setRoleAction(userId: string, role: Role): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return denied;
  if (role !== 'admin' && role !== 'student') return { ok: false, error: 'Unknown role.' };
  if (userId === admin.id) return { ok: false, error: 'You can’t change your own role.' };
  if (!(await repo.findUserById(userId))) return gone;
  await repo.setRole(userId, role);
  refresh();
  return { ok: true };
}

/** Make a member one of the course's teachers (they edit its lesson words), or a student again. */
export async function setTeacherAction(courseId: string, userId: string, teacher: boolean): Promise<Result> {
  if (!(await requireAdmin())) return denied;
  if (typeof teacher !== 'boolean') return { ok: false, error: 'Unknown choice.' };
  if (typeof userId !== 'string' || !(await repo.membership(courseId, userId))) return gone;
  await repo.setCourseRole(courseId, userId, teacher ? 'teacher' : 'student');
  refresh();
  return { ok: true };
}

/** Take someone off the course's leaderboard or put them back. Off it, they keep studying as usual. */
export async function setClassAction(courseId: string, userId: string, inClass: boolean): Promise<Result> {
  if (!(await requireTeacher(courseId))) return notTeacher;
  if (typeof inClass !== 'boolean') return { ok: false, error: 'Unknown choice.' };
  if (typeof userId !== 'string' || !(await repo.membership(courseId, userId))) return gone;
  await repo.setOnBoard(courseId, userId, inClass);
  refresh();
  return { ok: true };
}

/** The lesson the class is on: "All decks" brings in new words from it first. '' clears it. */
export async function setClassLessonAction(courseId: string, deck: string): Promise<Result> {
  if (!(await requireTeacher(courseId))) return notTeacher;
  if (typeof deck !== 'string' || deck.length > 100) return { ok: false, error: 'Unknown lesson.' };
  if (!(await repo.setClassLesson(courseId, deck.trim() || null))) return { ok: false, error: 'No shared words in that deck.' };
  refresh();
  return { ok: true };
}

const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** The course's name and its note for students (e.g. "More words coming soon"). */
export async function updateCourseAction(courseId: string, name: string, note: string): Promise<Result> {
  if (!(await requireTeacher(courseId))) return notTeacher;
  const n = cleanText(name, 60);
  if (!n) return { ok: false, error: 'Give the course a name.' };
  await repo.updateCourse(courseId, { name: n, note: cleanText(note, 80) });
  refresh();
  return { ok: true };
}

/**
 * A speaking club for the course's students: a time, and a room or an https link. Shown on their
 * study page with "I'll come".
 */
export async function createClubAction(courseId: string, startsAt: number, place: string): Promise<Result> {
  const user = await requireTeacher(courseId);
  if (!user) return notTeacher;
  const now = Date.now();
  if (!Number.isFinite(startsAt) || startsAt < now - 60 * 60_000 || startsAt > now + 90 * 24 * 60 * 60_000) {
    return { ok: false, error: 'Pick a time in the next 90 days.' };
  }
  const where = cleanText(place, 200);
  // Shown as a link only when it is one https address; anything else is plain text
  if (/:\/\//.test(where) && !/^https:\/\/\S+$/i.test(where)) {
    return { ok: false, error: 'A link must start with https:// (or write a room, e.g. Room 204).' };
  }
  await createClub(courseId, Math.round(startsAt), where, user.id);
  refresh();
  return { ok: true };
}

export async function deleteClubAction(courseId: string, clubId: string): Promise<Result> {
  if (!(await requireTeacher(courseId))) return notTeacher;
  if (typeof clubId !== 'string' || !(await deleteClub(courseId, clubId))) return { ok: false, error: 'That club no longer exists.' };
  refresh();
  return { ok: true };
}

/** A new course. Its id is its link (/c/<id>), so it can't change later. */
export async function createCourseAction(input: { id: string; name: string; targetLang: string; note: string }): Promise<Result> {
  if (!(await requireAdmin())) return denied;
  const id = cleanText(input?.id, 30).toLowerCase();
  const name = cleanText(input?.name, 60);
  if (!name) return { ok: false, error: 'Give the course a name.' };
  if (!isCourseId(id)) return { ok: false, error: 'The link may use a–z, 0–9 and dashes (2 to 30 characters), e.g. english-b1.' };
  if (RESERVED_COURSE_IDS.has(id)) return { ok: false, error: 'That link is already used by the site. Pick another one.' };
  if (!isTargetLang(input?.targetLang)) return { ok: false, error: 'Pick the language studied.' };
  if ((await repo.createCourse({ id, name, targetLang: input.targetLang, note: cleanText(input?.note, 80) })) === 'taken') {
    return { ok: false, error: 'A course with that link already exists.' };
  }
  refresh();
  return { ok: true };
}

export async function deleteUserAction(userId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return denied;
  if (userId === admin.id) return { ok: false, error: 'You can’t delete your own profile here.' };
  await repo.deleteUser(String(userId));
  refresh();
  return { ok: true };
}
