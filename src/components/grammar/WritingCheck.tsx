'use client';

import { useState } from 'react';
import { useLocalState } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { checkWriting } from '@/lib/client/grammar';
import { goal } from '@/lib/client/metrica';
import type { PerfektCheck } from '@/lib/grammar/perfekt';
import { Icon } from '../ui';
import { Screen } from './shared';

const MAX = 800;

/**
 * Free writing, the last step: "What did you do yesterday?" in 3–5 sentences, checked by the AI.
 * The text stays on this device until it's checked, so closing the page loses nothing.
 */
export function WritingCheck({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const [text, setText] = useLocalState<string>('kk.perfekt.text', '', (v) => typeof v === 'string');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [check, setCheck] = useState<PerfektCheck | null>(null);

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await checkWriting(text, lang);
      goal('grammar_check', { sentences: r.sentences, perfekt: r.perfekt });
      setCheck(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('Write it in the Perfekt')} sub="AI" onClose={onClose} closeLabel={t('Close')}
      foot={check ? (
        <button className="btn btn-primary" onClick={() => setCheck(null)}><Icon name="undo" /> {t('Edit my text and check again')}</button>
      ) : (
        <button className="btn btn-primary" onClick={() => void send()} disabled={busy || text.trim().length < 10 || text.length > MAX}>
          <Icon name="sparkle" /> {busy ? t('Checking… (about 20 seconds)') : t('Check my text')}
        </button>
      )}>
      <section className="panel gr-write">
        <p className="gr-prompt" lang="de">Was hast du gestern oder am Wochenende gemacht?</p>
        <p className="muted">{t('Write 3–5 sentences in German, in the Perfekt. The AI marks every mistake and names the rule.')}</p>
        <p className="muted small">{t('For example:')} <i lang="de">Am Samstag habe ich eingekauft. Dann bin ich ins Kino gegangen.</i></p>
        {!check && (
          <>
            <textarea className="answer-box ym-hide-content ym-disable-keys" rows={7} value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))}
              lang="de" spellCheck={false} autoCapitalize="sentences" aria-label={t('Your text')} disabled={busy} />
            <p className="muted small gr-count">{text.length}/{MAX}</p>
          </>
        )}
        {error && <p className="err" role="alert">{t(error)}</p>}
      </section>

      {check && (
        <>
          <section className="gr-score" aria-live="polite">
            <b>{check.perfekt}<span className="muted">/{check.sentences}</span></b>
            <span>{t('sentences in the Perfekt')}</span>
          </section>
          {check.summary && <p className="panel">{check.summary}</p>}
          <section className="panel ym-hide-content">
            <h2 className="gr-h">{t('Mistakes')}</h2>
            {check.corrections.length ? (
              <ul className="corrections">
                {check.corrections.map((c, i) => (
                  <li key={i}>
                    <span className="wrong" lang="de">{c.wrong}</span> → <span className="right" lang="de">{c.right}</span>
                    {c.why && <span className="why">{c.why}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="ok-text"><Icon name="check" /> {t('No mistakes. Well done!')}</p>}
          </section>
          {check.corrected && (
            <section className="panel ym-hide-content">
              <h2 className="gr-h">{t('Corrected text')}</h2>
              <p lang="de" className="gr-corrected">{check.corrected}</p>
            </section>
          )}
          {check.tip && <p className="notice"><b>{t('Tip:')}</b> {check.tip}</p>}
        </>
      )}
      <p className="muted small">{t('Your text is only sent to the AI to be checked; it is not saved.')}</p>
    </Screen>
  );
}
