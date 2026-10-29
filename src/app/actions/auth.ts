'use server';

/**
 * Sign up, log in, password links and change password, as Server Actions. (Log out is
 * POST /api/logout; Google is POST /api/auth/google.) Forms post here directly, so they work even before JavaScript
 * loads. Next.js checks that the request comes from this site (Origin vs Host) before running
 * an action. Every input is validated here with the zod schemas, whatever the browser checked.
 */
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { cleanDisplayName, normalizeEmail, safeNext } from '@/lib/account-rules';
import { changePasswordSchema, forgotSchema, formValues, loginSchema, parseForm, resetSchema, signupSchema } from '@/lib/auth-schemas';
import { chosenCourse } from '@/lib/server/course';
import { describeDbError } from '@/lib/server/db-health';
import { appUrl, RESET_MINUTES, sendPasswordEmail } from '@/lib/server/mail';
import { burnPasswordCheck, hashPassword, verifyPassword } from '@/lib/server/password';
import { clientIp, hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { currentUser, endSession, sessionToken, startSession } from '@/lib/server/session';
import { VISITOR_RE } from '@/lib/text';
import { HOUR, MIN } from '@/lib/time';
import type { UiLang } from '@/lib/types';

export interface FormState {
  error?: string;
  success?: string;
  fields?: Record<string, string>;
  fieldErrors?: Record<string, string>;
}

/** The same answer whether the email is unknown, has no password (Google only) or the password is wrong. */
const WRONG = 'Wrong email or password.';
const TOO_MANY = 'Too many attempts. Wait 15 minutes, then try again.';
/** The same answer whether or not the email has a profile. */
const LINK_SENT = 'If that email exists, we’ve sent a link. It works for 45 minutes; check your spam folder too.';
const LINK_DEAD = 'This link has expired or was already used. Ask for a new one.';

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
      courseId: await chosenCourse(),
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

const langOf = (form: FormData): UiLang => (form.get('lang') === 'uz' ? 'uz' : 'en');

/**
 * Make a password link and email it once the answer has gone out (after()), so answering takes
 * about as long whether or not the email has a profile. A Google-only profile gets a "set a
 * password" email: the same link, worded for someone who has no password yet.
 */
async function mailPasswordLink(user: repo.UserRow, lang: UiLang): Promise<void> {
  const token = await repo.createResetToken(user.id, RESET_MINUTES * MIN);
  const link = `${await appUrl()}/reset-password?token=${token}`;
  const purpose = user.hasPassword ? 'reset' : 'set';
  after(() => sendPasswordEmail({ to: user.email, name: user.displayName, link, lang, purpose }).then(() => undefined));
}

export async function forgotPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const input = formValues(form, ['email']);
  const fields = { email: normalizeEmail(input.email) };
  const parsed = parseForm(forgotSchema, input);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, fields };
  const { email } = parsed.data;
  try {
    if (!(await hit(`forgot:ip:${await clientIp()}`, 10, HOUR))) return { error: 'Too many requests from this network. Try again in an hour.', fields };
    // At most 3 emails an hour to one address. Beyond that the answer stays the same, but nothing is sent.
    if (await hit(`forgot:email:${email}`, 3, HOUR)) {
      const user = await repo.findUserByEmail(email);
      if (user) await mailPasswordLink(user, langOf(form));
    }
  } catch (e) {
    return unavailable(e, fields);
  }
  return { success: LINK_SENT };
}

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = parseForm(resetSchema, formValues(form, ['token', 'password', 'confirm']));
  if (!parsed.ok) return parsed.fieldErrors.token ? { error: LINK_DEAD } : { fieldErrors: parsed.fieldErrors };
  try {
    if (!(await hit(`reset:ip:${await clientIp()}`, 20, 15 * MIN))) return { error: TOO_MANY };
    // Every session of this profile ends with the reset, this browser's too: log in with the new password.
    const user = await repo.useResetToken(parsed.data.token, await hashPassword(parsed.data.password));
    if (!user) return { error: LINK_DEAD };
    await repo.ensureAdminRole(user); // the link proved the address
    await endSession();
  } catch (e) {
    return unavailable(e);
  }
  redirect('/login?reset=1');
}

/** Signed in, e.g. with Google only: email yourself a link to set (or reset) a password. */
export async function emailPasswordLink(_prev: FormState, form: FormData): Promise<FormState> {
  let user: repo.UserRow | null;
  try {
    user = await currentUser();
  } catch (e) {
    return unavailable(e);
  }
  if (!user) redirect('/login?next=/account');
  if (!user.email) return { error: 'Your profile has no email address. Ask your teacher to reset your password.' };
  try {
    if (!(await hit(`forgot:email:${user.email}`, 3, HOUR))) return { error: 'We’ve already sent you a few links. Check your inbox, or try again in an hour.' };
    await mailPasswordLink(user, langOf(form));
  } catch (e) {
    return unavailable(e);
  }
  return { success: 'We’ve emailed you a link. It works for 45 minutes; check your spam folder too.' };
}
