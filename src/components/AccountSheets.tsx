'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { CHEERS, type CheerKind } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { CHEER_ICON } from './ClassView';
import { Avatar, Icon } from './ui';
import { useUI } from './ui-context';

/**
 * The menu behind your photo in the top bar: who you are, your account page, settings, log out.
 * Only admins see an email address here (their own); students see their name and photo.
 */
export function AccountSheet() {
  const { me } = useStore();
  const ui = useUI();
  const { t } = useT();
  if (!me) return null;
  return (
    <BottomSheet title={t('Your profile')}>
      <div className="profile-head">
        <Avatar id={me.id} name={me.displayName} src={me.avatarUrl} size="lg" />
        <div>
          <p className="me-name">{me.displayName}</p>
          {me.email && <p className="muted small">{me.email}</p>}
          <span className={`role-pill role-${me.teacher ? 'admin' : 'student'}`}>{t(me.role === 'admin' ? 'Admin · teacher' : me.teacher ? 'Teacher' : me.inClass ? 'Student' : 'Off the leaderboard')}</span>
        </div>
      </div>
      <div className="optlist show-icons">
        {me.teacher && (
          <Link className="opt" href="/admin">
            {t('Admin dashboard')} <Icon name="shield" />
          </Link>
        )}
        <Link className="opt" href="/account">{t('Account and password')} <Icon name="key" /></Link>
        <button className="opt" onClick={() => ui.openSheet({ kind: 'settings' })}>{t('Study settings')} <Icon name="sliders" /></button>
      </div>
      <form method="post" action="/api/logout">
        <button className="btn btn-xl" type="submit">
          <Icon name="logout" /> {t('Log out')}
        </button>
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
