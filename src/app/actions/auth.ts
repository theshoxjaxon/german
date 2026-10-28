'use server';

/**
 * Sign up, log in and change password, as Server Actions. (Log out is POST /api/logout; Google
 * is POST /api/auth/google.) Forms post here directly, so they work even before JavaScript
 * loads. Next.js checks that the request comes from this site (Origin vs Host) before running
 * an action. Every input is validated here with the zod schemas, whatever the browser checked.
 */
import { redirect } from 'next/navigation';
import { cleanDisplayName, normalizeEmail, safeNext } from '@/lib/account-rules';
import { changePasswordSchema, formValues, loginSchema, parseForm, signupSchema } from '@/lib/auth-schemas';
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

/** The same answer whether the email is unknown, has no password (Google only) or the password is wrong. */
const WRONG = 'Wrong email or password.';
const TOO_MANY = 'Too many attempts. Wait 15 minutes, then try again.';

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
  const input = formValues(form, ['email', 'password']);
  const email = normalizeEmail(input.email);
  const fields = { email };
  try {
    const ip = await clientIp();
    if (!(await hit(`login:ip:${ip}`, 30, 15 * MIN)) || !(await hit(`login:email:${email}`, 10, 15 * MIN))) {
      return { error: TOO_MANY, fields };
    }
    const parsed = parseForm(loginSchema, input);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, fields };
    const user = await repo.findUserByEmail(parsed.data.email);
    if (!user?.passwordHash) {
      await burnPasswordCheck(parsed.data.password); // same timing whether or not there is a password to check
      return { error: WRONG, fields };
    }
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return { error: WRONG, fields };
    await repo.ensureAdminRole(user);
    await startSession(user.id);
  } catch (e) {
    return unavailable(e, fields);
  }
  redirect(safeNext(form.get('next'))); // outside try: redirect() works by throwing
}

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const input = formValues(form, ['name', 'email', 'password', 'confirm']);
  const visitor = String(form.get('visitor') ?? '');
  const fields = { name: cleanDisplayName(input.name), email: normalizeEmail(input.email) };
  try {
    if (!(await hit(`signup:${await clientIp()}`, 20, HOUR))) return { error: 'Too many new profiles from this network. Try again in an hour.', fields };
    const parsed = parseForm(signupSchema, input);
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, fields };
    const { name, email, password } = parsed.data;
    const user = await repo.createUser({
      email,
      displayName: name,
      passwordHash: await hashPassword(password),
      visitorId: VISITOR_RE.test(visitor) ? visitor : null,
    });
    if (user === 'taken') return { fieldErrors: { email: 'Email already registered.' }, fields };
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
  if (!user) redirect('/login?next=/account');
  const parsed = parseForm(changePasswordSchema, formValues(form, ['current', 'password', 'confirm']));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  try {
    if (!(await hit(`password:${user.id}`, 10, 15 * MIN))) return { error: TOO_MANY };
    if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { fieldErrors: { current: 'That’s not your current password.' } };
    await repo.setPasswordHash(user.id, await hashPassword(parsed.data.password));
    await repo.deleteUserSessions(user.id, await sessionToken()); // sign out your other devices
  } catch (e) {
    return unavailable(e);
  }
  return { success: 'Password changed. Your other devices were signed out.' };
}
