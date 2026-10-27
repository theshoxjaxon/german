'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { changePassword, type FormState } from '@/app/actions/auth';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { CHEERS, type CheerKind } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { CHEER_ICON } from './ClassView';
import { Avatar, Icon } from './ui';
import { useUI } from './ui-context';

export function AccountSheet() {
  const { me } = useStore();
  const ui = useUI();
  const { t } = useT();
  if (!me) return null;
  return (
    <BottomSheet title={t('Your profile')}>
      <div className="profile-head">
        <Avatar id={me.id} name={me.displayName} size="lg" />
        <div>
          <p className="me-name">{me.displayName}</p>
          <p className="muted small">@{me.username}</p>
          <span className={`role-pill role-${me.role}`}>{t(me.role === 'admin' ? 'Admin · teacher' : me.inClass ? 'Student' : 'Studying on your own')}</span>
        </div>
      </div>
      <div className="optlist show-icons">
        {me.role === 'admin' && (
          <Link className="opt" href="/admin">
            {t('Admin dashboard')} <Icon name="shield" />
          </Link>
        )}
        <button className="opt" onClick={() => ui.openSheet({ kind: 'settings' })}>{t('Study settings')} <Icon name="sliders" /></button>
        <button className="opt" onClick={() => ui.openSheet({ kind: 'password' })}>{t('Change password')} <Icon name="key" /></button>
      </div>
      <form method="post" action="/api/logout">
        <button className="btn btn-xl" type="submit">
          <Icon name="logout" /> {t('Log out')}
        </button>
      </form>
    </BottomSheet>
  );
}

export function PasswordSheet() {
  const ui = useUI();
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const { t } = useT();
  const e = state.fieldErrors ?? {};
  return (
    <BottomSheet title={t('Change password')}>
      <form action={action} className="form" noValidate>
        <div className="field">
          <label htmlFor="pw-current">{t('Current password')}</label>
          <input id="pw-current" name="current" type="password" autoComplete="current-password" required data-autofocus aria-invalid={!!e.current} />
          {e.current && <p className="err">{t(e.current)}</p>}
        </div>
        <div className="field">
          <label htmlFor="pw-new">{t('New password')}</label>
          <input id="pw-new" name="newPassword" type="password" autoComplete="new-password" required minLength={8} aria-invalid={!!e.newPassword} />
          {e.newPassword ? <p className="err">{t(e.newPassword)}</p> : <p className="hint">{t('At least 8 characters')}</p>}
        </div>
        {state.error && <p className="err" role="alert">{t(state.error)}</p>}
        {state.success && <p className="ok-msg" role="status">{t(state.success)}</p>}
        <div className="btn-row">
          <button type="button" className="btn" onClick={ui.closeSheet}>{t(state.success ? 'Done' : 'Cancel')}</button>
          <button className="btn btn-primary" disabled={pending}>{t(pending ? 'Saving…' : 'Change password')}</button>
        </div>
      </form>
    </BottomSheet>
  );
}

export function CheerSheet({ to }: { to: string }) {
  const { classData } = useStore();
  const ui = useUI();
  const [busy, setBusy] = useState(false);
  const { t } = useT();
  const person = classData?.members.find((m) => m.id === to);
  if (!person) return null;
  const send = async (kind: CheerKind) => {
    setBusy(true);
    const ok = await store.sendCheer(to, kind);
    setBusy(false);
    if (ok) {
      ui.closeSheet();
      ui.toast(t('Cheer sent to {name}', { name: person.displayName }));
    }
  };
  return (
    <BottomSheet title={t('Cheer {name}', { name: person.displayName })}>
      <p className="lede">{t('They’ll see it the next time they open the app. You can send one cheer per classmate each day.')}</p>
      <div className="cheer-options">
        {(Object.keys(CHEERS) as CheerKind[]).map((k) => (
          <button key={k} className="cheer-option" disabled={busy} onClick={() => send(k)}>
            <span className="cheer-ic"><Icon name={CHEER_ICON[k]} /></span>
            {t(CHEERS[k])}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
