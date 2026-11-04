'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { LANGS } from '@/lib/courses';
import { useT } from '@/lib/client/i18n';
import type { ShareCard } from '@/lib/share';
import { BrandMark } from './auth/AuthShell';
import { Icon } from './ui';

/** /s/<id>: a classmate's shared result, and the way in: "Try it too" opens the same course. */
export function ShareView({ card }: { card: ShareCard }) {
  const { t, lang } = useT();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <main className="share">
      <header className="wel-top"><Link className="wel-brand" href="/"><BrandMark />Karteikasten</Link></header>
      <article className="share-card">
        <p className="eyebrow">{t(LANGS[card.targetLang].name)}</p>
        {card.kind === 'test' ? (
          <>
            <p className="share-who">{t('{name} took a mock test', { name: card.name })}</p>
            <h1 lang="de">{card.title} <span className="muted">· {card.subtitle}</span></h1>
            <p className="share-score">
              <b>{card.score}</b><span className="share-max">/{card.max}</span>
              {card.passed && <span className="share-pass" lang="de">bestanden</span>}
            </p>
          </>
        ) : (
          <>
            <p className="share-who">{t('{name} is learning every day', { name: card.name })}</p>
            <p className="share-score share-streak"><Icon name="flame" /><b>{card.streak}</b><span>{t(card.streak === 1 ? 'day in a row' : 'days in a row')}</span></p>
          </>
        )}
      </article>
      <section className="share-cta">
        <Link className="btn btn-primary btn-xl" href={`/${card.course}`}>{t('Try it too')} <Icon name="next" /></Link>
        <p className="hint">{t('Flashcards with Uzbek meanings, mock tests and study groups. Free.')}</p>
      </section>
    </main>
  );
}
