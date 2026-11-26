'use server';

/**
 * What teachers and admins change in /admin, as Server Actions. The rules (who may do what, what
 * is valid) live in the NestJS API; an action sends the change, and on success refreshes the page.
 */
import { refresh } from 'next/cache';
import { api, errorOf } from '@/lib/api';
import type { CheckLine } from '@/lib/admin-types';
import type { Role } from '@/lib/types';

type Result = { ok: true; password?: string } | { ok: false; error: string };
type Said = { ok: true; message: string } | { ok: false; error: string };

const UNREACHABLE = 'The app can’t reach its server right now. Please try again in a few minutes.';

/** One change: PUT/POST/DELETE to the API, then refresh the dashboard. */
async function change(method: string, path: string, body?: unknown): Promise<Result> {
  try {
    const r = await api<{ password?: string }>(`/admin${path}`, { method, body });
    if (!r.ok) return { ok: false, error: errorOf(r) };
    refresh();
    return { ok: true, ...(r.data.password ? { password: r.data.password } : {}) };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

async function say(path: string, method = 'POST'): Promise<Said> {
  try {
    const r = await api<{ message: string }>(`/admin${path}`, { method });
    if (!r.ok) return { ok: false, error: errorOf(r) };
    refresh();
    return { ok: true, message: r.data.message };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

const seg = encodeURIComponent;

/** A temporary password for someone who is locked out; they change it after logging in. */
export const resetPasswordAction = async (userId: string) => change('POST', `/users/${seg(userId)}/password`);
export const setRoleAction = async (userId: string, role: Role) => change('PUT', `/users/${seg(userId)}/role`, { role });
export const deleteUserAction = async (userId: string) => change('DELETE', `/users/${seg(userId)}`);
export const setTeacherAction = async (courseId: string, userId: string, teacher: boolean) => change('PUT', `/courses/${seg(courseId)}/members/${seg(userId)}/teacher`, { teacher });
export const setClassAction = async (courseId: string, userId: string, inClass: boolean) => change('PUT', `/courses/${seg(courseId)}/members/${seg(userId)}/class`, { inClass });
export const setClassLessonAction = async (courseId: string, deck: string) => change('PUT', `/courses/${seg(courseId)}/lesson`, { deck });
export const updateCourseAction = async (courseId: string, name: string, note: string) => change('PUT', `/courses/${seg(courseId)}`, { name, note });
export const createCourseAction = async (input: { id: string; name: string; targetLang: string; note: string }) => change('POST', '/courses', input);
export const createClubAction = async (courseId: string, startsAt: number, place: string) => change('POST', `/courses/${seg(courseId)}/clubs`, { startsAt, place });
export const deleteClubAction = async (courseId: string, clubId: string) => change('DELETE', `/courses/${seg(courseId)}/clubs/${seg(clubId)}`);

export const telegramSetupAction = async () => say('/telegram/setup');
export const telegramTestAction = async () => say('/telegram/test');
export const telegramQuizAction = async () => say('/telegram/quiz');

export async function telegramCheckAction(): Promise<{ ok: true; lines: CheckLine[] } | { ok: false; error: string }> {
  try {
    const r = await api<{ lines: CheckLine[] }>('/admin/telegram/check');
    return r.ok ? { ok: true, lines: r.data.lines } : { ok: false, error: errorOf(r) };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}
