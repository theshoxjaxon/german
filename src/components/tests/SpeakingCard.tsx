'use client';

import { useState, type CSSProperties } from 'react';
import { useLocalState } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { drawTopic, geminiPrompt, geminiUrl, SPEAKING_LESSONS, speakingCard } from '@/lib/tests/sprechkarten';
import { Icon } from '../ui';

/**
 * Tests → A1.1: practise the speaking part with the class's 60 cards. "Get a speaking topic"
 * draws one; "Speak with Gemini" copies a ready prompt (Gemini's role, the topic, what to
 * check, the feedback to give) and opens Gemini with it, so the student talks and gets
 * feedback there. The drawn card stays on this device, so it's still there after Gemini.
 */
export function SpeakingCard() {
  const { t, lang } = useT();
  const [id, setId] = useLocalState<string>('kk.sprechkarte', '', (v) => typeof v === 'string' && (v === '' || !!speakingCard(v)));
  const [help, setHelp] = useState(false);
  const [sent, setSent] = useState<'copied' | 'manual' | null>(null);
  const card = id ? speakingCard(id) : null;
  const prompt = card ? geminiPrompt(card, lang) : '';

  const draw = () => {
    setId(drawTopic(id || null).id);
    setHelp(false);
    setSent(null);
  };
  const speak = () => {
    if (!card) return;
    // Copy first, while this page still has focus (browsers refuse the clipboard after the new tab opens)
    const copied = navigator.clipboard?.writeText(prompt);
    window.open(geminiUrl(prompt), '_blank', 'noopener,noreferrer');
    if (!copied) return setSent('manual');
    copied.then(() => setSent('copied'), () => setSent('manual'));
  };

  const lesson = card ? SPEAKING_LESSONS[card.lesson] : null;
  return (
    <section className="sk" aria-labelledby="sk-h">
      <div className="sk-head">
        <h2 id="sk-h"><span lang="de">Sprechen üben</span> <span className="muted">· {t('60 speaking cards')}</span></h2>
        <p className="muted small">{t('The cards of Lektion 1–10, like in the exam. Get a topic, then speak it with Gemini: it listens and checks your grammar.')}</p>
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
            <button className="btn btn-primary" onClick={speak}><Icon name="mic" /> {t('Speak with Gemini')}</button>
            <button className="btn" onClick={draw}><Icon name="cards" /> {t('Another topic')}</button>
          </div>
          {sent === 'copied' ? (
            <p className="callout callout-ok" role="status">
              {t('Gemini opened with the prompt, and it’s copied too. If Gemini’s box is empty: tap and hold it → Paste → send. Then tap the 🎤 and answer in German. When you finish, say “Fertig”: Gemini gives your score and your mistakes.')}
            </p>
          ) : sent === 'manual' ? (
            <div className="sk-manual">
              <p className="hint">{t('Copy this prompt and send it to Gemini:')}</p>
              <textarea className="sk-prompt" readOnly value={prompt} rows={8} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : (
            <p className="muted small">{t('Gemini gets a ready prompt: it asks you this question, lets you speak, then checks your grammar and gives feedback.')}</p>
          )}
        </>
      )}
    </section>
  );
}
