'use client';

import Link from 'next/link';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { Icon, type IconName } from './ui';

/** Top-bar buttons for visitors without a profile. Logging in is always their choice. */
export function GuestActions() {
  const { t } = useT();
  return (
    <span className="appbar-guest">
      <Link className="btn btn-quiet btn-sm" href="/login">{t('Log in')}</Link>
      <Link className="btn btn-primary btn-sm" href="/signup">{t('Sign up')}</Link>
    </span>
  );
}

const LOCKED: Record<'class' | 'stats', { icon: IconName; title: string; text: string }> = {
  class: {
    icon: 'people',
    title: 'Study together with your class',
    text: 'See your classmates’ streaks and active words, and send each other cheers.',
  },
  stats: {
    icon: 'chart',
    title: 'Track your progress',
    text: 'Your streak, how much you remember, and every day you studied, in one place.',
  },
};

/** Shown instead of Class and Progress to guests: what they get with a free profile. */
export function LockedView({ feature }: { feature: keyof typeof LOCKED }) {
  const { icon, title, text } = LOCKED[feature];
  const { t } = useT();
  return (
    <div className="page">
      <section className="locked" aria-labelledby={`locked-${feature}`}>
        <span className="locked-ic">
          <Icon name={icon} />
          <span className="locked-badge"><Icon name="lock" /></span>
        </span>
        <h1 id={`locked-${feature}`}>{t(title)}</h1>
        <p>{t(text)}</p>
        <p className="muted small">{t('Create a free profile to unlock this. It takes a minute, no email needed.')}</p>
        <div className="locked-actions">
          <Link className="btn btn-primary btn-xl" href="/signup">{t('Create a free profile')}</Link>
          <p className="auth-switch">{t('Already have one?')} <Link href="/login">{t('Log in')}</Link></p>
        </div>
        <p className="hint">{t('The flashcards you practised as a guest come with you.')}</p>
      </section>
    </div>
  );
}

/** On the Study page for guests: where their progress lives and why a profile helps. */
export function GuestNote() {
  const { cards } = useStore();
  const { t, tn } = useT();
  const studied = cards.size;
  return (
    <section className="guest-note" aria-labelledby="guest-h">
      <h2 id="guest-h">{t('You’re studying as a guest')}</h2>
      <p>
        {studied
          ? tn(studied, 'Your progress on {n} word is saved on this device only.', 'Your progress on {n} words is saved on this device only.')
          : t('Your progress will be saved on this device only.')}{' '}
        {t('Create a free profile to keep it, build a streak and join your class.')}
      </p>
      <Link className="btn btn-primary" href="/signup">{t('Sign up free')}</Link>
      <p className="auth-switch">{t('Already have a profile?')} <Link href="/login">{t('Log in')}</Link></p>
    </section>
  );
}

/** Signed in, with guest progress left on this device: ask before adding it (the computer may be shared). */
export function GuestImportBanner() {
  const { guestWords } = useStore();
  const { t, tn } = useT();
  if (!guestWords) return null;
  return (
    <section className="guest-note" aria-labelledby="gi-h">
      <h2 id="gi-h">{t('Add your guest progress?')}</h2>
      <p>
        {tn(guestWords, 'Someone studied {n} word on this device without logging in. If that was you, add it to your profile.',
          'Someone studied {n} words on this device without logging in. If that was you, add it to your profile.')}{' '}
        {t('Words you already studied keep their progress.')}
      </p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => void store.importGuestProgress()}>{t('Add to my profile')}</button>
        <button className="btn" onClick={() => store.discardGuestProgress()}>{t('No, discard it')}</button>
      </div>
    </section>
  );
}
