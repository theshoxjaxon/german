'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '@/lib/client/i18n';
import { speak, useSpeechSupported } from '@/lib/client/speech';
import { store, useStore } from '@/lib/client/store';
import type { WordInfo } from '@/lib/queue';
import { initials } from '@/lib/account-rules';
import { splitTerm } from '@/lib/text';
import { useUI } from './ui-context';

/* ---------- icons (stroke icons on a 24px grid) ---------- */
const ICONS = {
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  undo: '<path d="M9 15 4 10l5-5"/><path d="M4 10h10.5a5.5 5.5 0 0 1 0 11H12"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
  sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18M9 4v16"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  paste: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 11h7M8.5 15h4.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  cards: '<rect x="3" y="8" width="13" height="12" rx="2"/><path d="M7 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-4M12 16V7M17 16v-7"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.8" cy="9.5" r="2.6"/><path d="M15.6 14.6c2.4-.2 4.3 1.3 4.9 4.4"/>',
  flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-2.9 1.9-4.7 3.4-6.3.3 1.6 1 2.6 2 3.1-.3-3.4 1.2-6.2 3.6-8.2.2 2.7 1.4 4.3 2.4 5.8.8 1.2 1.6 2.4 1.6 4.3C19 18.6 16 21 12 21z"/>',
  logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H16"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  key: '<circle cx="8" cy="15" r="3.8"/><path d="m10.8 12.3 8-8M16.5 6.5l2.3 2.3M14 9l2 2"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z"/>',
  sparkle: '<path d="M11 3.5l1.8 4.9 4.9 1.8-4.9 1.8L11 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z"/><path d="M18.3 14.6l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>',
  camera: '<path d="M4 8.5h3.2l1.6-2.5h6.4l1.6 2.5H20V19H4z"/><circle cx="12" cy="13.5" r="3.4"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17.5 5-4.5 3.5 3 3-2.5 4.5 4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  book: '<path d="M4 5.5c2.7-1 5.3-1 8 .8 2.7-1.8 5.3-1.8 8-.8v13c-2.7-1-5.3-1-8 .8-2.7-1.8-5.3-1.8-8-.8z"/><path d="M12 6.3v13"/>',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name }: { name: IconName }) {
  // The markup comes from the constant table above, never from user data.
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

/** "die Familie" with the article in its gender colour (der blue, die red, das green). */
export function Term({ term }: { term: string }) {
  const { art, rest } = splitTerm(term);
  if (!art) return <>{rest}</>;
  return (
    <>
      <span className={`art art-${art}`}>{art}</span> {rest}
    </>
  );
}

const STATUS_LABEL = { new: 'New', learning: 'Learning', review: 'Review', suspended: 'Paused' } as const;

export function StatusPill({ info }: { info: Pick<WordInfo, 'status' | 'relearning' | 'leech'> }) {
  const { t } = useT();
  const label = t(info.status === 'learning' && info.relearning ? 'Relearning' : STATUS_LABEL[info.status]);
  return (
    <>
      <span className={`pill st-${info.status}`}>
        <i />
        {label}
      </span>
      {info.leech && <span className="leech">{t('Leech')}</span>}
    </>
  );
}

export function SpeakButton({ text, small = false }: { text: string | undefined; small?: boolean }) {
  const supported = useSpeechSupported();
  const { prefs } = useStore();
  const { t } = useT();
  if (!supported || !text) return null;
  return (
    <button type="button" className={`speak ${small ? 'sm' : ''}`} aria-label={t('Play pronunciation')} onClick={() => speak(text, prefs.ttsLang, prefs.slowSpeech)}>
      <Icon name="volume" />
    </button>
  );
}

/** A button that needs a second tap within 3.5 s, instead of a confirm() dialog. */
export function ConfirmButton({ className = 'btn', confirmLabel, onConfirm, children }: {
  className?: string;
  confirmLabel: string;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={className}
      data-armed={armed ? '1' : undefined}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

/** A round avatar with initials; the colour comes from the user id, so it never changes. */
/** A round photo (from Google) or, without one, initials on a colour picked from the id. */
export function Avatar({ id, name, src, size = 'md' }: { id: string; name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const [broken, setBroken] = useState<string | null>(null);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  if (src && broken !== src) {
    return (
      <span className={`avatar avatar-photo avatar-${size}`} aria-hidden="true">
        {/* A plain <img>: a tiny, already-sized photo from Google; no-referrer, as Google's photo links expect */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" referrerPolicy="no-referrer" decoding="async" onError={() => setBroken(src)} />
      </span>
    );
  }
  return (
    <span className={`avatar av-${h % 8} avatar-${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function LoadError() {
  const { loadProblem } = useStore();
  const { t } = useT();
  return (
    <div className="panel error-panel" role="alert">
      <p>
        {loadProblem === 'server'
          ? t('The app’s server is having trouble right now. Your progress is safe; try again in a few minutes.')
          : t('Could not load your words. Check your internet connection, then try again.')}
      </p>
      <button className="btn" onClick={() => store.load()}>{t('Try again')}</button>
    </div>
  );
}

export function EmptyBox() {
  const ui = useUI();
  const { me } = useStore();
  const { t } = useT();
  if (!me) {
    return (
      <section className="panel empty">
        <h2>{t('No words yet')}</h2>
        <p>{t('The teacher hasn’t added any words. Check back soon.')}</p>
      </section>
    );
  }
  if (!me.teacher) {
    return (
      <section className="panel empty">
        <h2>{t('No words yet')}</h2>
        <p>{t('Your teacher hasn’t added lesson words yet. You can add your own words now: only you see them.')}</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => ui.openSheet({ kind: 'word', id: null })}>{t('Add a word')}</button>
          <button className="btn" onClick={() => ui.openSheet({ kind: 'import' })}>{t('Paste a list')}</button>
        </div>
      </section>
    );
  }
  return (
    <section className="panel empty">
      <h2>{t('Your card box is empty')}</h2>
      <p>{t('Add words one at a time, or paste a whole list from your lesson. Every word becomes a flashcard.')}</p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => ui.openSheet({ kind: 'word', id: null })}>{t('Add a word')}</button>
        <button className="btn" onClick={() => ui.openSheet({ kind: 'import' })}>{t('Paste a list')}</button>
      </div>
    </section>
  );
}

export function SyncNote() {
  const { guest } = useStore();
  const { t } = useT();
  return (
    <p className={`sync${guest ? ' is-local' : ''}`}>
      <span className="dot" />
      {t(guest ? 'Progress saved on this device only' : 'Progress saved to your profile')}
    </p>
  );
}
