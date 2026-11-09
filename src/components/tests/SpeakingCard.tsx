'use client';

import { useState, type CSSProperties } from 'react';
import { useLocalState } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { drawTopic, GEMINI_URL, geminiPrompt, SPEAKING_LESSONS, speakingCard } from '@/lib/tests/sprechkarten';
import { Icon } from '../ui';

/**
 * Tests → A1.1: practise the speaking part with the class's 60 cards. "Get your speaking topic"
 * draws one; "Copy & open Gemini" copies a ready message (the topic, Gemini's role, feedback
 * after every answer, a summary on "finish") and opens Gemini, where the student pastes it and
 * speaks. Gemini doesn't take a message from a link, so pasting is a step of its own, shown as one.
 * The drawn card stays on this device, so it's still there after Gemini.
 */
export function SpeakingCard() {
  const { t, lang } = useT();
  const [id, setId] = useLocalState<string>('kk.sprechkarte', '', (v) => typeof v === 'string' && (v === '' || !!speakingCard(v)));
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const [showText, setShowText] = useState(false);
  const card = id ? speakingCard(id) : null;
  const prompt = card ? geminiPrompt(card, lang) : '';

  const draw = () => {
    setId(drawTopic(id || null).id);
    setHelp(false);
    setCopied(null);
    setShowText(false);
  };
  /** Copy the message. Started before anything else, while this page still has focus. */
  const copy = () => {
    const done = navigator.clipboard?.writeText(prompt);
    if (!done) {
      setCopied('failed');
      setShowText(true);
      return;
    }
    done.then(() => setCopied('yes'), () => {
      setCopied('failed');
      setShowText(true);
    });
  };
  const copyAndOpen = () => {
    if (!card) return;
    copy();
    window.open(GEMINI_URL, '_blank', 'noopener,noreferrer');
  };

  const lesson = card ? SPEAKING_LESSONS[card.lesson] : null;
  return (
    <section className="sk" aria-labelledby="sk-h">
      <div className="sk-head">
        <h2 id="sk-h"><span lang="de">Sprechen üben</span> <span className="muted">· {t('60 speaking cards')}</span></h2>
        <p className="muted small">{t('The cards of Lektion 1–10, like in the exam. Get a topic, then speak it with Gemini: it corrects every answer and gives you a score.')}</p>
      </div>

      {!card || !lesson ? (
        <button className="btn btn-primary btn-xl" onClick={draw}><Icon name="cards" /> {t('Get your speaking topic')}</button>
      ) : (
        <>
          <article key={card.id} className="sk-card" style={{ '--lc': lesson.color } as CSSProperties} aria-live="polite">
            <header className="sk-band">
              <span lang="de">Lektion {card.lesson} · {lesson.title}</span>
              <b className="sk-num">{card.id}</b>
            </header>
            <p className="sk-q" lang="de">{card.question}</p>
            {help ? (
              <p className="sk-hint" lang="de"><b>Hilfe:</b> {card.hint}</p>
            ) : (
              <button className="btn btn-quiet btn-sm sk-help" onClick={() => setHelp(true)}>{t('Show the “Hilfe” line')}</button>
            )}
          </article>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={copyAndOpen}><Icon name="copy" /> {t('Copy & open Gemini')}</button>
            <button className="btn" onClick={draw}><Icon name="cards" /> {t('Another topic')}</button>
          </div>
          {copied === 'yes' && <p className="sk-copied ok-text" role="status"><Icon name="check" /> {t('Copied. In Gemini: tap the message box → Paste → send.')}</p>}
          {copied === 'failed' && <p className="err" role="alert">{t('Couldn’t copy. Select the message below, copy it, and paste it in Gemini.')}</p>}

          <ol className="sk-steps">
            <li>{t('Tap “Copy & open Gemini”: the message is copied and Gemini opens.')}</li>
            <li>{t('In Gemini, tap the message box → Paste → send.')}</li>
            <li>{t('Tap 🎤 and answer in German. Gemini corrects each answer and asks the next question.')}</li>
            <li>{t('Say “finish”: you get your score, all your mistakes and a model answer.')}</li>
          </ol>

          <div className="sk-message">
            <button className="btn btn-quiet btn-sm" aria-expanded={showText} onClick={() => setShowText((v) => !v)}>
              <Icon name={showText ? 'down' : 'next'} /> {t(showText ? 'Hide the message' : 'Show the message')}
            </button>
            {showText && (
              <>
                <textarea className="sk-prompt" readOnly value={prompt} rows={12} onFocus={(e) => e.currentTarget.select()} aria-label={t('The message for Gemini')} />
                <button className="btn btn-sm" onClick={copy}><Icon name="copy" /> {t('Copy again')}</button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
