'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { listen, recognitionSupported } from '@/lib/client/listen';
import { playScript, stopSpeech, useSpeechSupported } from '@/lib/client/speech';
import { clearDraft, fetchTest, readDraft, saveDraft, submitTest, type Draft } from '@/lib/client/tests';
import { useClientValue } from '@/lib/client/hooks';
import { sectionMeta, type AttemptDetail, type Line, type PublicItem, type PublicTask, type PublicTest, type ReadText } from '@/lib/tests/types';
import { ConfirmButton, Icon } from '../ui';

/** Exam recordings play twice, like in the Goethe exam. */
export const PLAYS = 2;
const LETTERS = ['a', 'b', 'c', 'd'];

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Taking a test: one section at a time, answers kept on this device until handed in. */
export function TestRunner({ testId, onClose, onDone }: { testId: string; onClose: () => void; onDone: (a: AttemptDetail) => void }) {
  const { t, tn, lang } = useT();
  const [test, setTest] = useState<PublicTest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => readDraft(testId) ?? { answers: {}, startedAt: Date.now(), section: 0, plays: {} });
  const [now, setNow] = useState(() => Date.now());
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetchTest(testId).then((x) => live && setTest(x), (e: Error) => live && setError(e.message));
    return () => {
      live = false;
      stopSpeech();
    };
  }, [testId]);
  useEffect(() => saveDraft(testId, draft), [testId, draft]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const setAnswer = (id: string, v: string | number | boolean) => setDraft((d) => ({ ...d, answers: { ...d.answers, [id]: v } }));
  const played = (key: string) => setDraft((d) => ({ ...d, plays: { ...d.plays, [key]: (d.plays[key] ?? 0) + 1 } }));
  const go = (i: number) => {
    stopSpeech();
    setDraft((d) => ({ ...d, section: i }));
    body.current?.scrollTo({ top: 0 });
  };

  const allItems = test ? test.sections.flatMap((s) => s.tasks.flatMap((tk) => tk.items)) : [];
  const unanswered = allItems.filter((it) => {
    const v = draft.answers[it.id];
    return v === undefined || v === '';
  }).length;
  const submit = async () => {
    stopSpeech();
    setBusy(true);
    setError('');
    try {
      const r = await submitTest(testId, draft.answers, draft.startedAt);
      clearDraft(testId);
      onDone(r.attempt);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const idx = Math.min(draft.section, (test?.sections.length ?? 1) - 1);
  const section = test?.sections[idx];
  const meta = section ? sectionMeta(section.id) : undefined;
  const last = !!test && idx === test.sections.length - 1;

  return (
    <div className="runner" role="dialog" aria-modal="true" aria-label={test ? `${test.title} · ${test.subtitle}` : t('Mock test')}>
      <div className="rv-top">
        <button className="icon-btn" onClick={onClose} aria-label={t('Close the test (your answers stay on this device)')}><Icon name="x" /></button>
        <div className="runner-title">
          <b>{test ? `${test.title} · ${meta?.title ?? ''}` : t('Mock test')}</b>
          <span className="muted small">{test ? `${idx + 1} / ${test.sections.length}` : ''}</span>
        </div>
        <span className="runner-time" title={t('Time so far')}>{mmss(now - draft.startedAt)}{test ? <span className="muted"> / {test.minutes}:00</span> : null}</span>
      </div>
      <div className="rv-bar"><i style={{ width: `${test ? ((idx + 1) / test.sections.length) * 100 : 0}%` }} /></div>

      <div className="runner-body" ref={body}>
        {!test ? (
          <div className="panel" aria-busy={!error}>{error ? <p className="err">{t(error)}</p> : t('Loading the test…')}</div>
        ) : (
          <>
            <header className="sec-head">
              <p className="eyebrow">{t(meta?.label ?? '')}</p>
              <h2 lang="de">{meta?.title}</h2>
            </header>
            {section!.tasks.map((task) => (
              <TaskView key={task.id} task={task} answers={draft.answers} plays={draft.plays} uz={lang === 'uz'} onAnswer={setAnswer} onPlayed={played} />
            ))}
            {error && <p className="err" role="alert">{t(error)}</p>}
          </>
        )}
      </div>

      {test && (
        <div className="runner-foot">
          <button className="btn" onClick={() => go(idx - 1)} disabled={idx === 0 || busy}><Icon name="back" /> {t('Back')}</button>
          {!last ? (
            <button className="btn btn-primary" onClick={() => go(idx + 1)}>{t('Next')} <Icon name="next" /></button>
          ) : unanswered > 0 ? (
            <ConfirmButton className="btn btn-primary" confirmLabel={tn(unanswered, '{n} question is empty. Tap again to hand in', '{n} questions are empty. Tap again to hand in')}
              onConfirm={() => void submit()}>
              {busy ? t('Handing in…') : t('Hand in')}
            </ConfirmButton>
          ) : (
            <button className="btn btn-primary" onClick={() => void submit()} disabled={busy} aria-busy={busy}>{busy ? t('Handing in…') : t('Hand in')}</button>
          )}
        </div>
      )}
    </div>
  );
}

/** One Teil: its instruction, texts or recording, and questions. */
function TaskView({ task, answers, plays, uz, onAnswer, onPlayed }: {
  task: PublicTask;
  answers: Draft['answers'];
  plays: Draft['plays'];
  uz: boolean;
  onAnswer: (id: string, v: string | number | boolean) => void;
  onPlayed: (key: string) => void;
}) {
  return (
    <section className="task" aria-label={task.title}>
      <h3 lang="de">{task.title}</h3>
      <p className="task-instr" lang="de">{task.instruction}</p>
      {uz && <p className="task-instr-uz">{task.instructionUz}</p>}
      {task.audio && <AudioPlayer lines={task.audio} played={plays[task.id] ?? 0} onPlayed={() => onPlayed(task.id)} />}
      {task.texts?.map((x, i) => <ReadTextView key={i} text={x} />)}
      {task.items.some((it) => it.type === 'form') ? (
        <div className="form-fill">
          {task.items.map((it) => <ItemView key={it.id} item={it} value={answers[it.id]} plays={plays} uz={uz} onAnswer={onAnswer} onPlayed={onPlayed} />)}
        </div>
      ) : (
        <ol className="items">
          {task.items.map((it) => (
            <li key={it.id}><ItemView item={it} value={answers[it.id]} plays={plays} uz={uz} onAnswer={onAnswer} onPlayed={onPlayed} /></li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ReadTextView({ text }: { text: ReadText }) {
  return (
    <div className={`readtext rt-${text.kind}`} lang="de">
      {text.title && <p className="rt-title">{text.title}</p>}
      <p className="rt-body">{text.body}</p>
    </div>
  );
}

function ItemView({ item, value, plays, uz, onAnswer, onPlayed }: {
  item: PublicItem;
  value: string | number | boolean | undefined;
  plays: Draft['plays'];
  uz: boolean;
  onAnswer: (id: string, v: string | number | boolean) => void;
  onPlayed: (key: string) => void;
}) {
  const { t } = useT();
  const set = (v: string | number | boolean) => onAnswer(item.id, v);
  const extras = (
    <>
      {item.audio && <AudioPlayer lines={item.audio} played={plays[item.id] ?? 0} onPlayed={() => onPlayed(item.id)} />}
      {item.text && <ReadTextView text={item.text} />}
    </>
  );
  switch (item.type) {
    case 'choice':
      return (
        <div className="q">
          {extras}
          {item.reply !== undefined ? (
            <div className="q-dialogue" lang="de">
              <p className="q-prompt"><span className="dlg" aria-hidden="true">■</span>{item.prompt}</p>
              <p className="q-reply"><span className="dlg" aria-hidden="true">•</span>{item.reply}</p>
            </div>
          ) : (
            <p className="q-prompt" lang="de">{item.prompt}</p>
          )}
          <div className={`opts${item.options.some((o) => o.length > 40) ? ' opts-long' : ''}`} role="radiogroup" aria-label={item.reply ? `${item.prompt} ${item.reply}` : item.prompt}>
            {item.options.map((o, i) => (
              <button key={i} type="button" className="opt-ans" role="radio" aria-checked={value === i} onClick={() => set(i)} lang="de">
                <span className="opt-l">{LETTERS[i]}</span><span>{o}</span>
              </button>
            ))}
          </div>
        </div>
      );
    case 'truefalse':
      return (
        <div className="q q-tf">
          {extras}
          <p className="q-prompt" lang="de">{item.prompt}</p>
          <div className="tf" role="radiogroup" aria-label={item.prompt}>
            <button type="button" className="opt-ans" role="radio" aria-checked={value === true} onClick={() => set(true)} lang="de">richtig</button>
            <button type="button" className="opt-ans" role="radio" aria-checked={value === false} onClick={() => set(false)} lang="de">falsch</button>
          </div>
        </div>
      );
    case 'gap': {
      const [before, after = ''] = item.prompt.split('___');
      return (
        <div className="q">
          {extras}
          <p className="q-gap" lang="de">
            {before}
            <input className="gap" value={typeof value === 'string' ? value : ''} onChange={(e) => set(e.target.value)} aria-label={item.prompt}
              autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} lang="de" size={Math.max(6, (item.hint?.length ?? 6) + 2)} />
            {after}
            {item.hint && <span className="gap-hint"> ({item.hint})</span>}
          </p>
        </div>
      );
    }
    case 'form':
      return (
        <label className="field form-field">
          <span className="label" lang="de">{item.label}</span>
          <input value={typeof value === 'string' ? value : ''} onChange={(e) => set(e.target.value)} autoComplete="off" spellCheck={false} lang="de" />
        </label>
      );
    case 'writing': {
      const text = typeof value === 'string' ? value : '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      return (
        <div className="q">
          <p className="q-prompt" lang="de">{item.prompt}</p>
          {uz && <p className="task-instr-uz">{item.promptUz}</p>}
          <ul className="points" lang="de">{item.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <textarea className="answer-box ym-hide-content ym-disable-keys" rows={8} value={text} onChange={(e) => set(e.target.value)} lang="de" spellCheck={false}
            aria-label={t('Your text')} placeholder={t('Write your text here…')} />
          <p className={`muted small${words >= item.words * 0.8 ? ' ok' : ''}`}>{t('{n} words (about {target})', { n: words, target: item.words })}</p>
        </div>
      );
    }
    case 'speaking':
      return (
        <SpeakingItemView item={item} value={typeof value === 'string' ? value : ''} uz={uz} onChange={set}
          played={plays[item.id] ?? 0} onPlayed={() => onPlayed(item.id)} />
      );
  }
}

function SpeakingItemView({ item, value, uz, onChange, played, onPlayed }: {
  item: Extract<PublicItem, { type: 'speaking' }>;
  value: string;
  uz: boolean;
  onChange: (v: string) => void;
  played: number;
  onPlayed: () => void;
}) {
  const { t } = useT();
  const canListen = useClientValue(recognitionSupported, false);
  const [on, setOn] = useState(false);
  const [interim, setInterim] = useState('');
  const [problem, setProblem] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(() => () => stop.current?.(), []);

  const toggle = () => {
    if (on) {
      stop.current?.();
      return;
    }
    setProblem('');
    setOn(true);
    stop.current = listen('de-DE', {
      onText: (text) => {
        if (!text) return;
        const next = latest.current.trim() ? `${latest.current.trim()} ${text}` : text;
        latest.current = next;
        onChange(next);
      },
      onInterim: setInterim,
      onEnd: () => {
        setOn(false);
        stop.current = null;
      },
      onError: (code) => setProblem(code === 'not-allowed' || code === 'service-not-allowed'
        ? 'The microphone is blocked. Allow it in the browser, or type your answer.'
        : code === 'no-speech' ? 'Nothing was heard. Tap the microphone and speak.' : 'Speech recognition stopped. You can type your answer instead.'),
    });
  };

  return (
    <div className="q">
      {item.audio && <AudioPlayer lines={item.audio} played={played} onPlayed={onPlayed} />}
      <p className="q-prompt" lang="de">{item.kind === 'partner' ? <><span className="dlg" aria-hidden="true">■</span>{item.prompt}</> : item.prompt}</p>
      {uz && <p className="task-instr-uz">{item.promptUz}</p>}
      {item.cards.length > 0 && <div className="cards-row" lang="de">{item.cards.map((c) => <span key={c} className="word-card">{c}</span>)}</div>}
      {canListen && (
        <button type="button" className={`btn mic${on ? ' is-on' : ''}`} onClick={toggle} aria-pressed={on}>
          <Icon name="mic" /> {t(on ? 'Stop' : 'Speak')}
        </button>
      )}
      {on && <p className="muted small" aria-live="polite">{interim || t('Listening… speak German.')}</p>}
      {problem && <p className="err small">{t(problem)}</p>}
      <textarea className="answer-box ym-hide-content ym-disable-keys" rows={5} value={value} onChange={(e) => onChange(e.target.value)} lang="de" spellCheck={false}
        aria-label={t('What you say')} placeholder={t(canListen ? 'Tap Speak, or type what you would say…' : 'Type what you would say…')} />
    </div>
  );
}

/** A recording, read aloud by the device: at most PLAYS times. Without voices, the text is shown instead. */
function AudioPlayer({ lines, played, onPlayed }: { lines: Line[]; played: number; onPlayed: () => void }) {
  const { t } = useT();
  const supported = useSpeechSupported();
  const [playing, setPlaying] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const left = PLAYS - played;

  if (!supported) {
    return (
      <div className="audio-fallback" lang="de">
        <p className="muted small">{t('This browser can’t read aloud, so read it here instead:')}</p>
        {lines.map((l, i) => <p key={i}>{l.text}</p>)}
      </div>
    );
  }
  const play = () => {
    if (playing || left <= 0) return;
    setPlaying(true);
    onPlayed();
    stop.current = playScript(lines, 'de-DE', () => {
      setPlaying(false);
      stop.current = null;
    });
  };
  return (
    <div className="audio">
      <button type="button" className="btn audio-btn" onClick={play} disabled={playing || left <= 0} aria-busy={playing}>
        <Icon name="volume" /> {t(playing ? 'Playing…' : left === PLAYS ? 'Listen' : left > 0 ? 'Listen again' : 'Played twice')}
      </button>
      <span className="muted small">{left > 0 ? t('{n} of {max} plays left', { n: left, max: PLAYS }) : ''}</span>
    </div>
  );
}

/** For the result screen: the recording as text. */
export function Transcript({ lines }: { lines: Line[] }) {
  const { t } = useT();
  return (
    <details className="transcript">
      <summary>{t('Transcript')}</summary>
      <div lang="de">
        {lines.map((l, i) => (
          <Fragment key={i}>
            <p><span className="who">{l.who === 'a' ? 'A' : l.who === 'b' ? 'B' : '📢'}</span> {l.text}</p>
          </Fragment>
        ))}
      </div>
    </details>
  );
}
