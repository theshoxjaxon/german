'use client';

import Link from 'next/link';
import { store, useStore } from '@/lib/client/store';
import { plural } from '@/lib/time';
import { Icon, type IconName } from './ui';

/** Top-bar buttons for visitors without a profile. Logging in is always their choice. */
export function GuestActions() {
  return (
    <span className="appbar-guest">
      <Link className="btn btn-quiet btn-sm" href="/login">Log in</Link>
      <Link className="btn btn-primary btn-sm" href="/signup">Sign up</Link>
    </span>
  );
}

const LOCKED: Record<'words' | 'class' | 'stats', { icon: IconName; title: string; text: string }> = {
  words: {
    icon: 'table',
    title: 'Browse the whole word list',
    text: 'Search, sort and filter every word, with examples, forms and memory hooks.',
  },
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

/** Shown instead of Words, Class and Progress to guests: what they get with a free profile. */
export function LockedView({ feature }: { feature: keyof typeof LOCKED }) {
  const { icon, title, text } = LOCKED[feature];
  return (
    <div className="page">
      <section className="locked" aria-labelledby={`locked-${feature}`}>
        <span className="locked-ic">
          <Icon name={icon} />
          <span className="locked-badge"><Icon name="lock" /></span>
        </span>
        <h1 id={`locked-${feature}`}>{title}</h1>
        <p>{text}</p>
        <p className="muted small">Create a free profile to unlock this. You only need the join code from your teacher.</p>
        <div className="locked-actions">
          <Link className="btn btn-primary btn-xl" href="/signup">Create a free profile</Link>
          <p className="auth-switch">Already have one? <Link href="/login">Log in</Link></p>
        </div>
        <p className="hint">The flashcards you practised as a guest come with you.</p>
      </section>
    </div>
  );
}

/** On the Study page for guests: where their progress lives and why a profile helps. */
export function GuestNote() {
  const { cards } = useStore();
  const studied = cards.size;
  return (
    <section className="guest-note" aria-labelledby="guest-h">
      <h2 id="guest-h">You’re studying as a guest</h2>
      <p>
        {studied
          ? `Your progress on ${plural(studied, 'word', 'words')} is saved on this device only. `
          : 'Your progress will be saved on this device only. '}
        Create a free profile to keep it, build a streak and join your class.
      </p>
      <div className="btn-row">
        <Link className="btn btn-primary" href="/signup">Sign up free</Link>
        <Link className="btn" href="/login">Log in</Link>
      </div>
    </section>
  );
}

/** Signed in, with guest progress left on this device: ask before adding it (the computer may be shared). */
export function GuestImportBanner() {
  const { guestWords } = useStore();
  if (!guestWords) return null;
  return (
    <section className="guest-note" aria-labelledby="gi-h">
      <h2 id="gi-h">Add your guest progress?</h2>
      <p>
        Someone studied {plural(guestWords, 'word', 'words')} on this device without logging in. If that was you, add it to your profile.
        Words you already studied keep their progress.
      </p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => void store.importGuestProgress()}>Add to my profile</button>
        <button className="btn" onClick={() => store.discardGuestProgress()}>No, discard it</button>
      </div>
    </section>
  );
}
