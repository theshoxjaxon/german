'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { login, signup, type FormState } from '@/app/actions/auth';
import { useClientValue } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { noteVisit, visitorId } from '@/lib/client/visitor';

const readNext = () => new URLSearchParams(window.location.search).get('next') ?? '/';

function PasswordField({ id, label, autoComplete, error, hint }: { id: string; label: string; autoComplete: string; error?: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  const { t } = useT();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input id={id} name={id} type={shown ? 'text' : 'password'} autoComplete={autoComplete} required minLength={8}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} />
        <button type="button" className="reveal" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {t(shown ? 'Hide' : 'Show')}
        </button>
      </div>
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" id={`${id}-err`}>{t(error)}</p>}
    </div>
  );
}

function TextField({ id, label, error, hint, defaultValue, ...rest }: {
  id: string; label: string; error?: string; hint?: string; defaultValue?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useT();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} defaultValue={defaultValue} aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" id={`${id}-err`}>{t(error)}</p>}
    </div>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const next = useClientValue(readNext, '/');
  const { t } = useT();
  return (
    <form action={action} className="form auth-form" noValidate>
      <input type="hidden" name="next" value={next} />
      <TextField id="username" label={t('Username')} defaultValue={state.fields?.username} autoComplete="username"
        autoCapitalize="off" autoCorrect="off" spellCheck={false} required />
      <PasswordField id="password" label={t('Password')} autoComplete="current-password" />
      {state.error && <p className="err" role="alert">{t(state.error)}</p>}
      <button className="btn btn-primary btn-xl" disabled={pending}>{t(pending ? 'Logging in…' : 'Log in')}</button>
      <p className="auth-switch">{t('New here?')} <Link href="/signup">{t('Create a profile')}</Link></p>
      <p className="hint auth-note">{t('Forgot your password? Your teacher can reset it for you.')}</p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  const e = state.fieldErrors ?? {};
  const visitor = useClientValue(visitorId, null); // links this browser's guest visits to the new profile
  useEffect(noteVisit, []);
  const { t } = useT();
  return (
    <form action={action} className="form auth-form" noValidate>
      <input type="hidden" name="visitor" value={visitor ?? ''} />
      <TextField id="displayName" label={t('Your name')} defaultValue={state.fields?.displayName} error={e.displayName}
        autoComplete="name" hint={t('Shown to your classmates, e.g. Sardor Aliyev')} required maxLength={40} />
      <TextField id="username" label={t('Username')} defaultValue={state.fields?.username} error={e.username}
        autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        hint={t('3–20 characters: letters, numbers, _ or .')} required maxLength={20} />
      <PasswordField id="password" label={t('Password')} autoComplete="new-password" error={e.password} hint={t('At least 8 characters')} />
      <TextField id="joinCode" label={t('Class code (optional)')} defaultValue={state.fields?.joinCode} error={e.joinCode}
        autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="code-input"
        hint={t('From your teacher, to join your class. No code? Leave it empty and study on your own.')} maxLength={12} />
      {state.error && <p className="err" role="alert">{t(state.error)}</p>}
      <button className="btn btn-primary btn-xl" disabled={pending}>{t(pending ? 'Creating your profile…' : 'Create profile')}</button>
      <p className="auth-switch">{t('Already have a profile?')} <Link href="/login">{t('Log in')}</Link></p>
    </form>
  );
}
