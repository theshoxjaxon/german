'use client';

import { useState } from 'react';
import { speak, useSpeechSupported } from '@/lib/client/speech';
import { store, useStore } from '@/lib/client/store';
import type { Prefs } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import { ConfirmButton, Icon, SyncNote } from './ui';
import { useUI } from './ui-context';

const VOICES: [string, string][] = [
  ['de-DE', 'German (Germany)'], ['de-AT', 'German (Austria)'], ['de-CH', 'German (Switzerland)'],
  ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['fr-FR', 'French'], ['es-ES', 'Spanish'],
  ['it-IT', 'Italian'], ['ru-RU', 'Russian'], ['tr-TR', 'Turkish'],
];
const parseSteps = (s: string) =>
  s.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 1440).slice(0, 6);

function Stepper({ label, sub, value, min, max, step, onChange }: {
  label: string; sub: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="stepper">
      <span><b>{label}</b><br /><span className="muted small">{sub}</span></span>
      <span className="ctl">
        <button type="button" className="icon-btn" onClick={() => set(value - step)} aria-label={`Fewer: ${label}`}><Icon name="minus" /></button>
        <output aria-live="polite">{value}</output>
        <button type="button" className="icon-btn" onClick={() => set(value + step)} aria-label={`More: ${label}`}><Icon name="plus" /></button>
      </span>
    </div>
  );
}

export function SettingsSheet() {
  const { prefs } = useStore();
  const ui = useUI();
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
    <BottomSheet title="Study settings" footer={<button className="btn btn-primary" onClick={ui.closeSheet}>Done</button>}>
      <div className="form">
        <div className="settings-group">
          <p className="section-title">Daily limits</p>
          <Stepper label="New cards per day" sub="Words seen for the first time" value={prefs.newPerDay} min={0} max={200} step={5}
            onChange={(v) => store.setPrefs({ newPerDay: v })} />
          <Stepper label="Reviews per day" sub="Upper limit for repeat cards" value={prefs.maxReviews} min={10} max={2000} step={10}
            onChange={(v) => store.setPrefs({ maxReviews: v })} />
        </div>

        <div className="settings-group">
          <p className="section-title">Card types</p>
          <label className="toggle-row">
            <input type="checkbox" checked={prefs.dirF} onChange={(e) => setDir('dirF', e.target.checked)} />
            <span>Recognition<small>See the German word, recall the meaning</small></span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={prefs.dirR} onChange={(e) => setDir('dirR', e.target.checked)} />
            <span>Production<small>See the meaning, say the German word with its article. Each word gets a second card.</small></span>
          </label>
        </div>

        <div className="settings-group">
          <p className="section-title">Learning steps</p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="set-learn">New cards (minutes)</label>
              <input id="set-learn" value={learn} inputMode="numeric" autoComplete="off" onChange={(e) => setLearn(e.target.value)}
                onBlur={() => commitSteps('learnSteps', learn, setLearn)} />
            </div>
            <div className="field">
              <label htmlFor="set-relearn">Forgotten cards (minutes)</label>
              <input id="set-relearn" value={relearn} inputMode="numeric" autoComplete="off" onChange={(e) => setRelearn(e.target.value)}
                onBlur={() => commitSteps('relearnSteps', relearn, setRelearn)} />
            </div>
          </div>
          <p className="hint">Gaps before a card moves to day-based reviews. “1 10” shows a new card again after 1 minute, then after 10.</p>
        </div>

        <div className="settings-group">
          <p className="section-title">Pronunciation</p>
          {speech ? (
            <>
              <label className="toggle-row">
                <input type="checkbox" checked={prefs.autoplay} onChange={(e) => store.setPrefs({ autoplay: e.target.checked })} />
                <span>Read the word aloud<small>When a German card appears</small></span>
              </label>
              <div className="field">
                <label htmlFor="set-lang">Voice language</label>
                <select id="set-lang" value={prefs.ttsLang} onChange={(e) => {
                  store.setPrefs({ ttsLang: e.target.value });
                  speak('Guten Tag', e.target.value);
                }}>
                  {VOICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </>
          ) : (
            <p className="muted small">This browser has no built-in speech voices.</p>
          )}
        </div>

        <div className="settings-group">
          <p className="section-title">Your data</p>
          <SyncNote />
          <ConfirmButton className="btn btn-danger" confirmLabel="Tap again to erase all progress" onConfirm={resetAll}>
            Reset all my progress
          </ConfirmButton>
          <p className="hint">Words stay. Every card goes back to New.</p>
        </div>

        <details className="explain">
          <summary>How scheduling works</summary>
          <p>New cards first repeat after a few minutes (the learning steps). Once you get one right, it moves to day-based reviews scheduled with SM-2, the SuperMemo algorithm Anki is built on.</p>
          <ol>
            <li>Each card has an ease factor, starting at 2.5.</li>
            <li><b>Good</b> multiplies the interval by the ease, so it grows roughly 1 → 3 → 8 → 20 days.</li>
            <li><b>Hard</b> grows it by 20%, <b>Easy</b> by an extra 30%.</li>
            <li>
              Your answer then updates the ease with the SM-2 formula <code>EF&apos; = EF + 0.1 − (5−q)(0.08 + (5−q)·0.02)</code>,
              where Again = 2, Hard = 3, Good = 4, Easy = 5. Hard costs 0.14, Again 0.32, Easy adds 0.10. It never drops below 1.3.
            </li>
            <li><b>Again</b> on a review halves the interval and sends the card back to the learning steps.</li>
          </ol>
        </details>
      </div>
    </BottomSheet>
  );
}
