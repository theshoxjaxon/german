'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { login, signup, type FormState } from '@/app/actions/auth';
import { useClientValue } from '@/lib/client/hooks';

const readNext = () => new URLSearchParams(window.location.search).get('next') ?? '/';

function PasswordField({ id, label, autoComplete, error, hint }: { id: string; label: string; autoComplete: string; error?: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input id={id} name={id} type={shown ? 'text' : 'password'} autoComplete={autoComplete} required minLength={8}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} />
        <button type="button" className="reveal" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

function TextField({ id, label, error, hint, defaultValue, ...rest }: {
  id: string; label: string; error?: string; hint?: string; defaultValue?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} defaultValue={defaultValue} aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="err" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const next = useClientValue(readNext, '/');
  return (
    <form action={action} className="form auth-form" noValidate>
      <input type="hidden" name="next" value={next} />
      <TextField id="username" label="Username" defaultValue={state.fields?.username} autoComplete="username"
        autoCapitalize="off" autoCorrect="off" spellCheck={false} required />
      <PasswordField id="password" label="Password" autoComplete="current-password" />
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-xl" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      <p className="auth-switch">New here? <Link href="/signup">Create a profile</Link></p>
      <p className="hint auth-note">Forgot your password? Your teacher can reset it for you.</p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="form auth-form" noValidate>
      <TextField id="displayName" label="Your name" defaultValue={state.fields?.displayName} error={e.displayName}
        autoComplete="name" hint="Shown to your classmates, e.g. Sardor Aliyev" required maxLength={40} />
      <TextField id="username" label="Username" defaultValue={state.fields?.username} error={e.username}
        autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        hint="3–20 characters: letters, numbers, _ or ." required maxLength={20} />
      <PasswordField id="password" label="Password" autoComplete="new-password" error={e.password} hint="At least 8 characters" />
      <TextField id="joinCode" label="Join code" defaultValue={state.fields?.joinCode} error={e.joinCode}
        autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="code-input"
        hint="Your teacher gives you this code" required maxLength={12} />
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-xl" disabled={pending}>{pending ? 'Creating your profile…' : 'Create profile'}</button>
      <p className="auth-switch">Already have a profile? <Link href="/login">Log in</Link></p>
    </form>
  );
}
