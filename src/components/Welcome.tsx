'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { LANGS, type Course, type TargetLang } from '@/lib/courses';
import { useT } from '@/lib/client/i18n';
import { rememberLang } from '@/lib/client/lang-device';
import type { UiLang } from '@/lib/types';
import { BrandMark } from './auth/AuthShell';
import { Icon } from './ui';
import { goal } from '@/lib/client/metrica';

/**
 * The front door at /: "Hallo! Hello! Salom!", "Let's learn!", and a card for each course to pick
 * (/german, /english, …). Someone who already studies a course gets "Continue" to it as well.
 * Everything moves only when the device allows motion; otherwise it is all there at once.
 */

type CourseCard = Course & { tests: number };
type Data = { courses: CourseCard[]; current: string | null; signedIn: boolean };

/** Each language is named in itself, so you can find yours whatever the page shows now. */
const UI_LANGS: [UiLang, string][] = [['uz', 'Oʻzbekcha'], ['en', 'English']];
const HELLOS: [string, string][] = [['de', 'Hallo!'], ['en', 'Hello!'], ['uz', 'Salom!']];

/** A taste of each language on its card: German nouns in their article colours. */
const SAMPLES: Record<TargetLang, [string, string][]> = {
  de: [['der', 'Hund'], ['die', 'Katze'], ['das', 'Buch']],
  en: [['', 'hello'], ['', 'friend'], ['', 'book']],
};

/**
 * The word cards drifting behind everything: x and y in %, tilt, how long one drift takes, when it
 * starts, and whether it only shows on wider screens (on a phone it would sit behind the courses).
 */
const FLOATING: { w: string; lang: string; x: number; y: number; r: number; s: number; d: number; wide?: true }[] = [
  { w: 'der Apfel', lang: 'de', x: 4, y: 12, r: -8, s: 11, d: 0 },
  { w: 'book', lang: 'en', x: 78, y: 11, r: 7, s: 13, d: 0.4 },
  { w: 'doʻst', lang: 'uz', x: 86, y: 30, r: -5, s: 12, d: 0.8 },
  { w: 'Danke', lang: 'de', x: -3, y: 38, r: 6, s: 14, d: 0.2, wide: true },
  { w: 'water', lang: 'en', x: 2, y: 72, r: -6, s: 12, d: 0.6, wide: true },
  { w: 'die Schule', lang: 'de', x: 74, y: 66, r: 5, s: 15, d: 1, wide: true },
  { w: 'kitob', lang: 'uz', x: 40, y: 90, r: -3, s: 13, d: 1.2, wide: true },
  { w: 'Guten Morgen', lang: 'de', x: 56, y: 15, r: -4, s: 16, d: 1.4, wide: true },
];

/** When the course cards start dealing in, counted from the first paint. */
const DEAL_AT = 750;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** "Hallo!" → "Hello!" → "Salom!", one after another, flipping like a card. */
function Hello({ still }: { still: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % HELLOS.length), 1800);
    return () => window.clearInterval(id);
  }, [still]);
  if (still) {
    return (
      <p className="wel-hello is-still" aria-hidden="true">
        {HELLOS.map(([lang, w]) => <span key={lang} lang={lang}>{w}</span>)}
      </p>
    );
  }
  const [lang, w] = HELLOS[i];
  return (
    <p className="wel-hello" aria-hidden="true">
      <span key={i} lang={lang}>{w}</span>
    </p>
  );
}

export function Welcome() {
  const { t, tn, lang } = useT();
  const still = useReducedMotion();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [wait, setWait] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    let live = true;
    fetch('/api/courses', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Data>) : Promise.reject(new Error(String(r.status)))))
      .then(
        (d) => {
          if (!live) return;
          // Deal the cards when the greeting is done, however quickly they arrived
          setWait(Math.max(0, DEAL_AT - performance.now()));
          setData(d);
        },
        () => live && setFailed(true),
      );
    return () => {
      live = false;
    };
  }, [attempt]);

  const current = data?.courses.find((c) => c.id === data.current);
  const langName = (c: Course) => t(LANGS[c.targetLang].name);

  return (
    <main className="wel">
      <div className="wel-floating" aria-hidden="true">
        {FLOATING.map((f) => (
          <span key={f.w} className={`wel-float${f.wide ? ' is-wide' : ''}`} lang={f.lang}
            style={{ '--x': `${f.x}%`, '--y': `${f.y}%`, '--r': `${f.r}deg`, '--s': `${f.s}s`, '--d': `${f.d}s` } as CSSProperties}>
            {f.w}
          </span>
        ))}
      </div>

      <header className="wel-top">
        <span className="wel-brand"><BrandMark />Karteikasten</span>
        <span className="lang-switch" role="group" aria-label="Language · Til">
          {UI_LANGS.map(([code, name]) => (
            <button key={code} type="button" lang={code} aria-pressed={lang === code} onClick={() => rememberLang(code)}>{name}</button>
          ))}
        </span>
      </header>

      <section className="wel-hero">
        <Hello still={still} />
        <h1 className="wel-title"><span>{t('Let’s learn!')}</span></h1>
        <p className="wel-lede">{t('What do you want to learn?')}</p>
      </section>

      <section className="wel-pick" aria-label={t('Courses')} aria-busy={!data && !failed} style={{ '--wait': `${wait}ms` } as CSSProperties}>
        {failed ? (
          <div className="panel error-panel" role="alert">
            <p>{t('Could not load the courses. Check your internet connection, then try again.')}</p>
            <button className="btn" onClick={() => (setFailed(false), setAttempt((n) => n + 1))}>{t('Try again')}</button>
          </div>
        ) : !data ? (
          <div className="wel-courses" aria-hidden="true">
            <span className="wel-course is-ghost" />
            <span className="wel-course is-ghost" />
          </div>
        ) : (
          <>
            {current && (
              <Link className="btn btn-primary btn-xl wel-continue" href={`/${current.id}`} onClick={() => goal('course_pick', { course: current.id, continue: true })}>
                {t('Continue: {name}', { name: langName(current) })}
                <Icon name="next" />
              </Link>
            )}
            {current && data.courses.length > 1 && <p className="wel-or">{t('or pick another course')}</p>}
            <div className="wel-courses">
              {data.courses.map((c, i) => {
                const lang = LANGS[c.targetLang];
                const extra = c.name !== lang.name ? c.name.replace(`${lang.name} · `, '') : '';
                return (
                  <Link key={c.id} href={`/${c.id}`} onClick={() => goal('course_pick', { course: c.id })} className={`wel-course${c.id === data.current ? ' is-current' : ''}`}
                    style={{ '--i': i + (current ? 1 : 0), '--tilt': `${i % 2 ? 4 : -4}deg` } as CSSProperties}>
                    <span className="wel-course-h">
                      <span className="wel-badge" lang={c.targetLang}>{c.targetLang.toUpperCase()}</span>
                      <span className="wel-course-name">
                        <b>{langName(c)}</b>
                        {extra && <span className="muted small">{extra}</span>}
                      </span>
                      {c.id === data.current
                        ? <span className="wel-tag">{t('Your course')}</span>
                        : <Icon name="next" />}
                    </span>
                    <span className="wel-sample" lang={c.targetLang}>
                      {SAMPLES[c.targetLang].map(([art, w]) => (
                        <span key={w}>{art && <span className={`art art-${art}`}>{art}</span>}{art && ' '}{w}</span>
                      ))}
                    </span>
                    <span className="wel-meta">
                      {tn(c.words, '{n} word', '{n} words')}
                      {c.tests > 0 && <> · {tn(c.tests, '{n} mock test', '{n} mock tests')}</>}
                      {c.note && <> · {t(c.note)}</>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      {data && !data.signedIn && (
        <p className="wel-foot">
          {t('Already have an account?')} <Link href="/login">{t('Log in')}</Link>
        </p>
      )}
    </main>
  );
}
