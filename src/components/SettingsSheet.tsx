'use client';

import { useState } from 'react';
import { useCourseLang } from '@/lib/client/course';
import { useT } from '@/lib/client/i18n';
import { speak, useSpeechSupported } from '@/lib/client/speech';
import { store, useStore } from '@/lib/client/store';
import { voiceFor } from '@/lib/courses';
import type { Prefs, UiLang } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { ConfirmButton, Icon, SyncNote } from './ui';
import { useUI } from './ui-context';

/** Each language is named in itself, so you can find yours whatever the interface shows now. */
const LANGS: [UiLang, string][] = [['uz', 'Oʻzbekcha'], ['en', 'English']];
const parseSteps = (s: string) =>
  s.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 1440).slice(0, 6);

function Stepper({ label, sub, value, min, max, step, onChange }: {
  label: string; sub: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const { t } = useT();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="stepper">
      <span><b>{label}</b><br /><span className="muted small">{sub}</span></span>
      <span className="ctl">
        <button type="button" className="icon-btn" onClick={() => set(value - step)} aria-label={t('Fewer: {label}', { label })}><Icon name="minus" /></button>
        <output aria-live="polite">{value}</output>
        <button type="button" className="icon-btn" onClick={() => set(value + step)} aria-label={t('More: {label}', { label })}><Icon name="plus" /></button>
      </span>
    </div>
  );
}

export function SettingsSheet() {
  const { prefs } = useStore();
  const ui = useUI();
  const { t, lang } = useT();
  const studied = useCourseLang(); // the language of the course: its voices and card hints
  const voice = voiceFor(prefs.ttsLang, studied);
  const speech = useSpeechSupported();
  const [learn, setLearn] = useState(prefs.learnSteps.join(' '));
  const [relearn, setRelearn] = useState(prefs.relearnSteps.join(' '));

  const commitSteps = (key: 'learnSteps' | 'relearnSteps', text: string, setText: (s: string) => void) => {
    const steps = parseSteps(text);
    if (!steps.length) {
      setText(prefs[key].join(' '));
      ui.toast('Enter minutes, like 1 10');
      return;
    }
    setText(steps.join(' '));
    store.setPrefs({ [key]: steps } as Partial<Prefs>);
  };
  const setDir = (key: 'dirF' | 'dirR', on: boolean) => {
    const next = { dirF: prefs.dirF, dirR: prefs.dirR, [key]: on };
    if (!next.dirF && !next.dirR) return ui.toast('Keep at least one card type.');
    store.setPrefs(next);
  };
  const resetAll = () => {
    ui.closeSheet();
    void store.resetAllProgress().then((ok) => ok && ui.toast('All progress reset'));
  };

  return (
    <BottomSheet title={t('Study settings')} footer={<button className="btn btn-primary" onClick={ui.closeSheet}>{t('Done')}</button>}>
      <div className="form">
        <div className="settings-group">
          <p className="section-title">{lang === 'uz' ? 'Til · Language' : 'Language · Til'}</p>
          <span className="seg seg-board" role="group" aria-label={t('Language')}>
            {LANGS.map(([code, name]) => (
              <button key={code} className="seg-btn" lang={code} aria-pressed={lang === code} onClick={() => store.setPrefs({ uiLang: code })}>{name}</button>
            ))}
          </span>
        </div>

        <div className="settings-group">
          <p className="section-title">{t('Every day')}</p>
          <Stepper label={t('Daily goal')} sub={t(prefs.dailyGoal ? 'Answers to give each day' : 'Off: no daily goal')} value={prefs.dailyGoal} min={0} max={200} step={5}
            onChange={(v) => store.setPrefs({ dailyGoal: v })} />
          <Stepper label={t('New cards per day')} sub={t('Words seen for the first time')} value={prefs.newPerDay} min={0} max={200} step={5}
            onChange={(v) => store.setPrefs({ newPerDay: v })} />
        </div>

        <div className="settings-group">
          <p className="section-title">{t('Card types')}</p>
          <label className="toggle-row">
            <input type="checkbox" checked={prefs.dirF} onChange={(e) => setDir('dirF', e.target.checked)} />
            <span>{t('Recognition')}<small>{t(studied.text.recognitionHint)}</small></span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={prefs.dirR} onChange={(e) => setDir('dirR', e.target.checked)} />
            <span>{t('Production')}<small>{t(studied.text.productionHint)}</small></span>
          </label>
          {studied.articles && (
            <label className="toggle-row">
              <input type="checkbox" checked={prefs.genderQuiz} onChange={(e) => store.setPrefs({ genderQuiz: e.target.checked })} />
              <span>{t('der, die or das?')}<small>{t('For nouns, pick the article before you see the answer')}</small></span>
            </label>
          )}
        </div>

        <div className="settings-group">
          <p className="section-title">{t('Pronunciation')}</p>
          {speech ? (
            <>
              <label className="toggle-row">
                <input type="checkbox" checked={prefs.autoplay} onChange={(e) => store.setPrefs({ autoplay: e.target.checked })} />
                <span>{t('Read the word aloud')}<small>{t(studied.text.autoplayHint)}</small></span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={prefs.slowSpeech} onChange={(e) => {
                  store.setPrefs({ slowSpeech: e.target.checked });
                  speak(studied.sample, voice, e.target.checked);
                }} />
                <span>{t('Speak slowly')}<small>{t('Hear every sound clearly')}</small></span>
              </label>
            </>
          ) : (
            <p className="muted small">{t('This browser has no built-in speech voices.')}</p>
          )}
        </div>

        <details className="advanced">
          <summary>{t('Advanced')}</summary>
          <div className="form">
            <Stepper label={t('Reviews per day')} sub={t('Upper limit for repeat cards')} value={prefs.maxReviews} min={10} max={2000} step={10}
              onChange={(v) => store.setPrefs({ maxReviews: v })} />

            <div className="settings-group">
              <p className="section-title">{t('Learning steps')}</p>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="set-learn">{t('New cards (minutes)')}</label>
                  <input id="set-learn" value={learn} inputMode="numeric" autoComplete="off" onChange={(e) => setLearn(e.target.value)}
                    onBlur={() => commitSteps('learnSteps', learn, setLearn)} />
                </div>
                <div className="field">
                  <label htmlFor="set-relearn">{t('Forgotten cards (minutes)')}</label>
                  <input id="set-relearn" value={relearn} inputMode="numeric" autoComplete="off" onChange={(e) => setRelearn(e.target.value)}
                    onBlur={() => commitSteps('relearnSteps', relearn, setRelearn)} />
                </div>
              </div>
              <p className="hint">{t('Gaps before a card moves to day-based reviews. “1 10” shows a new card again after 1 minute, then after 10.')}</p>
            </div>

            {speech && (
              <div className="field">
                <label htmlFor="set-lang">{t('Voice language')}</label>
                <select id="set-lang" value={voice} onChange={(e) => {
                  store.setPrefs({ ttsLang: e.target.value });
                  speak(studied.hello, e.target.value, prefs.slowSpeech);
                }}>
                  {studied.voices.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
                </select>
              </div>
            )}

            <div className="settings-group">
              <p className="section-title">{t('Your data')}</p>
              <SyncNote />
              <ConfirmButton className="btn btn-danger" confirmLabel={t('Tap again to erase all progress')} onConfirm={resetAll}>
                {t('Reset all my progress')}
              </ConfirmButton>
              <p className="hint">{t('Words stay. Every card goes back to New.')}</p>
            </div>

            <details className="explain">
              <summary>{t('How scheduling works')}</summary>
              <p>{t('New cards first repeat after a few minutes (the learning steps). Once you get one right, it moves to day-based reviews scheduled with SM-2, the SuperMemo algorithm Anki is built on.')}</p>
              <ol>
                <li>{t('Each card has an ease factor, starting at 2.5.')}</li>
                <li>{t('Good multiplies the interval by the ease, so it grows roughly 1 → 3 → 8 → 20 days.')}</li>
                <li>{t('Hard grows it by 20%, Easy by an extra 30%.')}</li>
                <li>
                  {t('Your answer then updates the ease with the SM-2 formula')} <code>EF&apos; = EF + 0.1 − (5−q)(0.08 + (5−q)·0.02)</code>,{' '}
                  {t('where Again = 2, Hard = 3, Good = 4, Easy = 5. Hard costs 0.14, Again 0.32, Easy adds 0.10. It never drops below 1.3.')}
                </li>
                <li>{t('Again on a review halves the interval and sends the card back to the learning steps.')}</li>
              </ol>
            </details>
          </div>
        </details>
      </div>
    </BottomSheet>
  );
}
