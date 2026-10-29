'use server';

/**
 * Admin-only Server Actions. Each one checks the signed-in user's role itself:
 * a Server Action is a public endpoint, so hiding a button is never enough.
 */
import { refresh } from 'next/cache';
import { hashPassword, temporaryPassword } from '@/lib/server/password';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';
import type { Role } from '@/lib/types';

type Result = { ok: true; password?: string } | { ok: false; error: string };

async function requireAdmin() {
  const user = await currentUser();
  return user?.role === 'admin' ? user : null;
}
const denied: Result = { ok: false, error: 'Only admins can do this. Sign in again as an admin.' };

/** Set a new temporary password and sign the student out everywhere. */
export async function resetPasswordAction(userId: string): Promise<Result> {
  if (!(await requireAdmin())) return denied;
  if (typeof userId !== 'string' || !(await repo.findUserById(userId))) return { ok: false, error: 'That profile no longer exists.' };
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
  if (!(await repo.findUserById(userId))) return { ok: false, error: 'That profile no longer exists.' };
  await repo.setRole(userId, role);
  refresh();
  return { ok: true };
}

/** Take someone off the class leaderboard or put them back. Off it, they keep studying as usual. */
export async function setClassAction(userId: string, inClass: boolean): Promise<Result> {
  if (!(await requireAdmin())) return denied;
  if (typeof inClass !== 'boolean') return { ok: false, error: 'Unknown choice.' };
  if (typeof userId !== 'string' || !(await repo.findUserById(userId))) return { ok: false, error: 'That profile no longer exists.' };
  await repo.setInClass(userId, inClass);
  refresh();
  return { ok: true };
}

/** The lesson the class is on: "All decks" brings in new words from it first. '' clears it. */
export async function setClassLessonAction(deck: string): Promise<Result> {
  if (!(await requireAdmin())) return denied;
  if (typeof deck !== 'string' || deck.length > 100) return { ok: false, error: 'Unknown lesson.' };
  if (!(await repo.setClassLesson(deck.trim() || null))) return { ok: false, error: 'No shared words in that deck.' };
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
