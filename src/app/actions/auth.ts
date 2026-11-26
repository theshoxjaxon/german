'use server';

/**
 * Sign up, log in, password links and change password, as Server Actions. (Log out is
 * POST /api/auth/logout; Google is POST /api/auth/google.) Forms post here directly, so they work
 * even before JavaScript loads. Next.js checks that the request comes from this site (Origin vs
 * Host) before running an action. The work itself (validation, rate limits, hashing, email,
 * sessions) is done by the NestJS API: an action only passes the form on and relays the answer,
 * including the session cookie.
 */
import { redirect } from 'next/navigation';
import { formValues } from '@/lib/auth-schemas';
import { api, relayCookies } from '@/lib/api';

export interface FormState {
  error?: string;
  /** Sign-up done: the address a confirmation link was sent to. */
  sent?: string;
  /** Log-in refused because this address still has to be confirmed. */
  unconfirmed?: string;
  success?: string;
  fields?: Record<string, string>;
  fieldErrors?: Record<string, string>;
}

type ApiFormState = FormState & { redirect?: string };

/** The API can't be reached (down, or the database behind it is): say so on the form instead of crashing the page. */
const UNAVAILABLE = 'The app can’t reach its database right now. Please try again in a few minutes.';

/** Send a form to the API. Returns its FormState; a `redirect` in it is followed by the caller (redirect() works by throwing). */
async function send(path: string, input: Record<string, string>, fields?: Record<string, string>): Promise<ApiFormState & { signedOut?: boolean }> {
  try {
    const r = await api<ApiFormState & { error?: string }>(path, { method: 'POST', body: input });
    if (r.status === 401) return { signedOut: true };
    await relayCookies(r.setCookies);
    return r.ok ? r.data : { error: r.data.error ?? UNAVAILABLE, fields };
  } catch {
    return { error: UNAVAILABLE, fields };
  }
}

const withLang = (form: FormData, input: Record<string, string>) => ({ ...input, lang: form.get('lang') === 'uz' ? 'uz' : 'en' });

/** Follow a finished form's redirect, else hand its state back to the form. */
function done({ redirect: to, signedOut: _signedOut, ...state }: ApiFormState & { signedOut?: boolean }): FormState {
  if (to) redirect(to);
  return state;
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const input = formValues(form, ['email', 'password']);
  return done(await send('/auth/login', { ...input, next: String(form.get('next') ?? '') }));
}

/**
 * Sign up: nobody is logged in yet. The profile is made, a link is emailed, and clicking it
 * (GET /confirm-email) confirms the address, logs in and opens the app. Only real Gmail addresses.
 */
export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const input = formValues(form, ['name', 'email', 'password', 'confirm']);
  return done(await send('/auth/signup', withLang(form, { ...input, visitor: String(form.get('visitor') ?? '') })));
}

/** "Send it again" on the check-your-inbox screen and on a refused log-in. Same answer for any address. */
export async function resendConfirmation(_prev: FormState, form: FormData): Promise<FormState> {
  const input = formValues(form, ['email']);
  return done(await send('/auth/confirmation/resend', withLang(form, input)));
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const r = await send('/auth/password/change', formValues(form, ['current', 'password', 'confirm']));
  if (r.signedOut) redirect('/login?next=/account');
  return done(r);
}

export async function forgotPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const input = formValues(form, ['email']);
  return done(await send('/auth/password/forgot', withLang(form, input), { email: input.email }));
}

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  return done(await send('/auth/password/reset', formValues(form, ['token', 'password', 'confirm'])));
}

/** Signed in, e.g. with Google only: email yourself a link to set (or reset) a password. */
export async function emailPasswordLink(_prev: FormState, form: FormData): Promise<FormState> {
  const r = await send('/auth/password/email-link', withLang(form, {}));
  if (r.signedOut) redirect('/login?next=/account');
  return done(r);
}
