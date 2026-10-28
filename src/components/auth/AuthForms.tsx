'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { forgotPassword, login, resetPassword, signup, type FormState } from '@/app/actions/auth';
import { forgotSchema, formValues, loginSchema, parseForm, resetSchema, signupSchema, type FieldErrors } from '@/lib/auth-schemas';
import { useClientValue } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { noteVisit, visitorId } from '@/lib/client/visitor';
import { Icon } from '../ui';

const param = (name: string) => () => new URLSearchParams(window.location.search).get(name);
const readNext = () => param('next')() ?? '/';
const readReset = () => param('reset')() === '1';
const readToken = () => param('token')() ?? '';

export function PasswordField({ id, name = id, label, autoComplete, error, hint, autoFocus }: {
  id: string; name?: string; label: string; autoComplete: string; error?: string; hint?: string; autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const { t } = useT();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input id={id} name={name} type={shown ? 'text' : 'password'} autoComplete={autoComplete} required autoFocus={autoFocus}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} />
        <button type="button" className="reveal" onClick={() => setShown((s) => !s)} aria-pressed={shown}
          aria-label={t(shown ? 'Hide password' : 'Show password')}>
          {t(shown ? 'Hide' : 'Show')}
        </button>
      </div>
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" id={`${id}-err`}>{t(error)}</p>}
    </div>
  );
}

export function TextField({ id, name = id, label, error, hint, defaultValue, ...rest }: {
  id: string; name?: string; label: string; error?: string; hint?: string; defaultValue?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useT();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} defaultValue={defaultValue} aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" id={`${id}-err`}>{t(error)}</p>}
    </div>
  );
}

/**
 * Check a form in the browser with the same zod schema the server uses, before it is sent.
 * Errors from the browser show until the server answers; then the server's answer counts.
 * After either, the first field with a problem gets the focus.
 */
export function useCheckedForm(schema: z.ZodType, names: readonly string[], state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  const [checked, setChecked] = useState<{ for: FormState; errors: FieldErrors } | null>(null);
  const local = checked && checked.for === state ? checked.errors : null;
  const shown = local ?? state.fieldErrors; // one object per check, so the focus moves once per check
  useEffect(() => {
    if (shown) ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [shown]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const r = parseForm(schema, formValues(new FormData(e.currentTarget), names));
    if (r.ok) return setChecked(null);
    e.preventDefault();
    setChecked({ for: state, errors: r.fieldErrors });
  };
  return { ref, onSubmit, errors: shown ?? {}, formError: local ? undefined : state.error };
}

/** A short message at the bottom of the screen for a few seconds (screen readers hear it once). */
export function Toast({ message }: { message: string }) {
  const { t } = useT();
  const [gone, setGone] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setGone(message), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  const shown = !!message && gone !== message;
  return <div className={`toast${shown ? ' show' : ''}`} role="status" aria-live="polite">{shown ? t(message) : ''}</div>;
}

export function FormError({ message }: { message?: string }) {
  const { t } = useT();
  return message ? <p className="err" role="alert">{t(message)}</p> : null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const { ref, onSubmit, errors: e, formError } = useCheckedForm(loginSchema, ['email', 'password'], state);
  const next = useClientValue(readNext, '/');
  const reset = useClientValue(readReset, false); // just chose a new password
  const { t } = useT();
  return (
    <form ref={ref} action={action} onSubmit={onSubmit} className="form auth-form" noValidate>
      <Toast message={reset ? 'Password changed. Log in with your new password.' : ''} />
      <input type="hidden" name="next" value={next} />
      <TextField id="email" type="email" label={t('Email')} defaultValue={state.fields?.email} error={e.email}
        autoComplete="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} required maxLength={254} />
      <PasswordField id="password" label={t('Password')} autoComplete="current-password" error={e.password} />
      <p className="auth-forgot"><Link href="/forgot-password">{t('Forgot password?')}</Link></p>
      <FormError message={formError} />
      <button className="btn btn-primary btn-xl" disabled={pending} aria-busy={pending}>{t(pending ? 'Logging in…' : 'Log in')}</button>
      <p className="auth-switch">{t('New here?')} <Link href="/signup">{t('Create a profile')}</Link></p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  const { ref, onSubmit, errors: e, formError } = useCheckedForm(signupSchema, ['name', 'email', 'password', 'confirm'], state);
  const visitor = useClientValue(visitorId, null); // links this browser's guest visits to the new profile
  useEffect(noteVisit, []);
  const { t } = useT();
  return (
    <form ref={ref} action={action} onSubmit={onSubmit} className="form auth-form" noValidate>
      <input type="hidden" name="visitor" value={visitor ?? ''} />
      <TextField id="name" label={t('Your name')} defaultValue={state.fields?.name} error={e.name}
        autoComplete="name" hint={t('Shown to your classmates, e.g. Sardor Aliyev')} required maxLength={40} />
      <TextField id="email" type="email" label={t('Email')} defaultValue={state.fields?.email} error={e.email}
        autoComplete="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} required maxLength={254}
        hint={t('For logging in. Your classmates never see it.')} />
      <PasswordField id="password" label={t('Password')} autoComplete="new-password" error={e.password} hint={t('At least 8 characters')} />
      <PasswordField id="confirm" label={t('Confirm password')} autoComplete="new-password" error={e.confirm} />
      <FormError message={formError} />
      <button className="btn btn-primary btn-xl" disabled={pending} aria-busy={pending}>{t(pending ? 'Creating your profile…' : 'Create profile')}</button>
      <p className="auth-switch">{t('Already have a profile?')} <Link href="/login">{t('Log in')}</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPassword, {});
  const { ref, onSubmit, errors: e, formError } = useCheckedForm(forgotSchema, ['email'], state);
  const { t, lang } = useT();
  if (state.success) {
    return (
      <div className="auth-done">
        <span className="auth-done-ic"><Icon name="check" /></span>
        <p role="status">{t(state.success)}</p>
        <Link className="btn btn-xl" href="/login">{t('Back to log in')}</Link>
      </div>
    );
  }
  return (
    <form ref={ref} action={action} onSubmit={onSubmit} className="form auth-form" noValidate>
      <input type="hidden" name="lang" value={lang} />
      <TextField id="email" type="email" label={t('Email')} defaultValue={state.fields?.email} error={e.email}
        autoComplete="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} required maxLength={254} autoFocus />
      <FormError message={formError} />
      <button className="btn btn-primary btn-xl" disabled={pending} aria-busy={pending}>{t(pending ? 'Sending…' : 'Send me a link')}</button>
      <p className="hint auth-note">{t('Signed up with Google? The link lets you set a password too.')}</p>
      <p className="auth-switch"><Link href="/login">{t('Back to log in')}</Link></p>
    </form>
  );
}

const LINK_DEAD = 'This link has expired or was already used. Ask for a new one.';

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});
  const { ref, onSubmit, errors: e, formError } = useCheckedForm(resetSchema, ['token', 'password', 'confirm'], state);
  const token = useClientValue<string | null>(readToken, null); // null until the page runs in the browser
  const { t } = useT();
  const dead = !!e.token || formError === LINK_DEAD || token === '';
  return (
    <form ref={ref} action={action} onSubmit={onSubmit} className="form auth-form" noValidate>
      <input type="hidden" name="token" value={token ?? ''} />
      {dead ? (
        <div className="auth-done">
          <p className="err" role="alert">{t(LINK_DEAD)}</p>
          <Link className="btn btn-primary btn-xl" href="/forgot-password">{t('Send me a new link')}</Link>
        </div>
      ) : (
        <>
          <PasswordField id="password" label={t('New password')} autoComplete="new-password" error={e.password} hint={t('At least 8 characters')} autoFocus />
          <PasswordField id="confirm" label={t('Confirm new password')} autoComplete="new-password" error={e.confirm} />
          <FormError message={formError} />
          <button className="btn btn-primary btn-xl" disabled={pending || token === null} aria-busy={pending}>{t(pending ? 'Saving…' : 'Save new password')}</button>
        </>
      )}
      <p className="auth-switch"><Link href="/login">{t('Back to log in')}</Link></p>
    </form>
  );
}
