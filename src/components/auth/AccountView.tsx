'use client';

import { useActionState, useEffect } from 'react';
import { changePassword, emailPasswordLink, type FormState } from '@/app/actions/auth';
import { changePasswordSchema } from '@/lib/auth-schemas';
import { useT } from '@/lib/client/i18n';
import type { Me } from '@/lib/types';
import { Avatar, Icon } from '../ui';
import { FormError, PasswordField, Toast, useCheckedForm } from './AuthForms';
import { AuthShell } from './AuthShell';

/**
 * /account: who you are and how you log in. Email addresses are shown to admins only, so a
 * student sees their name and photo here but not their address.
 */
export function AccountView({ me }: { me: Me }) {
  const { t } = useT();
  return (
    <AuthShell title="Your account" lede="Your profile and how you log in." guest={false}>
      <div className="profile-head account-head">
        <Avatar id={me.id} name={me.displayName} src={me.avatarUrl} size="lg" />
        <div>
          <p className="me-name">{me.displayName}</p>
          {me.email && <p className="muted small">{me.email}</p>}
          <span className={`role-pill role-${me.teacher ? 'admin' : 'student'}`}>{t(me.role === 'admin' ? 'Admin · teacher' : me.teacher ? 'Teacher' : me.inClass ? 'Student' : 'Off the leaderboard')}</span>
        </div>
      </div>
      {!me.email && <p className="hint">{t('Your email address stays private: classmates never see it.')}</p>}

      <section className="account-sec" aria-labelledby="ways-h">
        <h2 id="ways-h">{t('How you log in')}</h2>
        <ul className="ways">
          <li>
            <span className="grow">Google</span>
            <span className={`way-state${me.hasGoogle ? ' is-on' : ''}`}>{t(me.hasGoogle ? 'Connected' : 'Not connected')}</span>
          </li>
          <li>
            <span className="grow">{t('Email and password')}</span>
            <span className={`way-state${me.hasPassword ? ' is-on' : ''}`}>{t(me.hasPassword ? 'Set' : 'Not set')}</span>
          </li>
        </ul>
        {!me.hasGoogle && <p className="hint">{t('To add Google, log in once with “Continue with Google” using the same email address.')}</p>}
      </section>

      <section className="account-sec" aria-labelledby="pw-h">
        <h2 id="pw-h">{t(me.hasPassword ? 'Change password' : 'Set a password')}</h2>
        {me.hasPassword ? <ChangePasswordForm /> : <PasswordLinkForm intro="You log in with Google. Set a password to log in with your email too: we’ll email you a link." />}
      </section>

      <form method="post" action="/api/logout" className="account-logout">
        <button className="btn btn-xl" type="submit"><Icon name="logout" /> {t('Log out')}</button>
      </form>
    </AuthShell>
  );
}

function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const { ref, onSubmit, errors: e, formError } = useCheckedForm(changePasswordSchema, ['current', 'password', 'confirm'], state);
  const { t } = useT();
  useEffect(() => {
    if (state.success) ref.current?.reset(); // clear the fields once it worked
  }, [state, ref]);
  return (
    <>
      <form ref={ref} action={action} onSubmit={onSubmit} className="form" noValidate>
        <PasswordField id="current" label={t('Current password')} autoComplete="current-password" error={e.current} />
        <PasswordField id="password" label={t('New password')} autoComplete="new-password" error={e.password} hint={t('At least 8 characters')} />
        <PasswordField id="confirm" label={t('Confirm new password')} autoComplete="new-password" error={e.confirm} />
        <FormError message={formError} />
        {state.success && <p className="ok-msg">{t(state.success)}</p>}
        <button className="btn btn-primary btn-xl" disabled={pending} aria-busy={pending}>{t(pending ? 'Saving…' : 'Change password')}</button>
        <Toast message={state.success ?? ''} />
      </form>
      <PasswordLinkForm intro="Forgot your current password?" quiet />
    </>
  );
}

/** Email yourself a link to set a password (Google only) or choose a new one. */
function PasswordLinkForm({ intro, quiet }: { intro: string; quiet?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(emailPasswordLink, {});
  const { t, lang } = useT();
  return (
    <form action={action} className={`form${quiet ? ' link-form' : ''}`}>
      <input type="hidden" name="lang" value={lang} />
      <p className={quiet ? 'hint' : undefined}>{t(intro)}</p>
      <FormError message={state.error} />
      {state.success ? (
        <p className="ok-msg" role="status">{t(state.success)}</p>
      ) : (
        <button className={quiet ? 'btn btn-sm' : 'btn btn-primary btn-xl'} disabled={pending} aria-busy={pending}>
          {t(pending ? 'Sending…' : 'Email me a link')}
        </button>
      )}
    </form>
  );
}
