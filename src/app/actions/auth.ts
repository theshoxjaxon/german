'use server';

/**
 * Sign up, log in and change password, as Server Actions. (Log out is POST /api/logout.)
 * Forms post here directly (they even work before JavaScript loads). Next.js also checks
 * that the request comes from this site (Origin vs Host) before running an action.
 */
import { redirect } from 'next/navigation';
import { cleanDisplayName, displayNameError, normalizeUsername, passwordError, safeNext, usernameError } from '@/lib/account-rules';
import { describeDbError } from '@/lib/server/db-health';
import { burnPasswordCheck, hashPassword, verifyPassword } from '@/lib/server/password';
import { clientIp, hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { currentUser, sessionToken, startSession } from '@/lib/server/session';
import { VISITOR_RE } from '@/lib/text';
import { HOUR, MIN } from '@/lib/time';

export interface FormState {
  error?: string;
  success?: string;
  fields?: Record<string, string>;
  fieldErrors?: Record<string, string>;
}

const WRONG = 'Wrong username or password.';

/**
 * The database is down or misconfigured: say so on the form instead of crashing the page.
 * The reason goes to the server log (and /api/health) for whoever runs the app.
 */
function unavailable(e: unknown, fields?: Record<string, string>): FormState {
  const { problem, message } = describeDbError(e);
  console.error(`Karteikasten: database unavailable (${problem}). ${message}`);
  return { error: 'The app can’t reach its database right now. Please try again in a few minutes.', fields };
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const username = normalizeUsername(form.get('username'));
  const password = String(form.get('password') ?? '');
  const fields = { username };
  const ip = await clientIp();
  if (!hit(`login:ip:${ip}`, 30, 15 * MIN) || !hit(`login:user:${username}`, 10, 15 * MIN)) {
    return { error: 'Too many attempts. Wait 15 minutes, then try again.', fields };
  }
  if (!username || !password) return { error: 'Enter your username and password.', fields };

  try {
    const user = await repo.findUserByUsername(username);
    if (!user) {
      await burnPasswordCheck(password); // same timing whether or not the username exists
      return { error: WRONG, fields };
    }
    if (!(await verifyPassword(password, user.passwordHash))) return { error: WRONG, fields };
    await startSession(user.id);
  } catch (e) {
    return unavailable(e, fields);
  }
  redirect(safeNext(form.get('next'))); // outside try: redirect() works by throwing
}

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const displayName = cleanDisplayName(form.get('displayName'));
  const username = normalizeUsername(form.get('username'));
  const password = String(form.get('password') ?? '');
  const joinCode = String(form.get('joinCode') ?? '').toUpperCase().replace(/[\s-]/g, '');
  const visitor = String(form.get('visitor') ?? '');
  const fields = { displayName, username, joinCode };

  if (!hit(`signup:${await clientIp()}`, 20, HOUR)) return { error: 'Too many new profiles from this network. Try again in an hour.', fields };

  const fieldErrors: Record<string, string> = {};
  const nameErr = displayNameError(displayName);
  const userErr = usernameError(username);
  const passErr = passwordError(password);
  if (nameErr) fieldErrors.displayName = nameErr;
  if (userErr) fieldErrors.username = userErr;
  if (passErr) fieldErrors.password = passErr;
  try {
    if (!joinCode || joinCode !== (await repo.getJoinCode())) fieldErrors.joinCode = 'This join code doesn’t match. Ask your teacher for the current code.';
    if (Object.keys(fieldErrors).length) return { fieldErrors, fields };

    const user = await repo.createUser({
      username,
      displayName,
      passwordHash: await hashPassword(password),
      visitorId: VISITOR_RE.test(visitor) ? visitor : null,
    });
    if (user === 'taken') return { fieldErrors: { username: 'This username is taken. Try another one.' }, fields };
    await startSession(user.id);
  } catch (e) {
    return unavailable(e, fields);
  }
  redirect('/');
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  let user: repo.UserRow | null;
  try {
    user = await currentUser();
  } catch (e) {
    return unavailable(e);
  }
  if (!user) redirect('/login');
  const current = String(form.get('current') ?? '');
  const newPassword = String(form.get('newPassword') ?? '');
  if (!hit(`password:${user.id}`, 10, 15 * MIN)) return { error: 'Too many attempts. Wait 15 minutes, then try again.' };
  if (!(await verifyPassword(current, user.passwordHash))) return { fieldErrors: { current: 'That’s not your current password.' } };
  const err = passwordError(newPassword);
  if (err) return { fieldErrors: { newPassword: err } };
  try {
    await repo.setPasswordHash(user.id, await hashPassword(newPassword));
    await repo.deleteUserSessions(user.id, await sessionToken()); // sign out your other devices
  } catch (e) {
    return unavailable(e);
  }
  return { success: 'Password changed. Your other devices were signed out.' };
}
