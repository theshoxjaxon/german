'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useT } from '@/lib/client/i18n';
import { saveSession, type SessionResult } from '@/lib/client/grammar';
import { goal } from '@/lib/client/metrica';
import type { Checked } from '@/lib/grammar/check';
import { writeOrder } from '@/lib/grammar/check';
import { RULES, sentence, transform, type Verb } from '@/lib/grammar/perfekt';
import { checkTask, MAX_RETRIES, retryAt, taskVerb, type Given, type Task } from '@/lib/grammar/session';
import { ConfirmButton, Icon } from '../ui';
import { Bracket, FEEDBACK, Partizip, RULE_TEXT, Screen, VerbForms } from './shared';

const UMLAUTS = ['ä', 'ö', 'ü', 'ß'];

/** A fixed shuffle per sentence, so the tiles don't jump around on every render. */
function shuffled(n: number, seed: string): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A practice session: 10 short tasks, one at a time, each checked at once with the rule behind
 * a mistake. A missed verb comes back a few tasks later. At the end the answers go to the server,
 * which checks them again and moves the rule bars.
 */
export function PerfektTrainer({ verbs, tasks: first, onClose, onSaved }: {
  verbs: Verb[];
  tasks: Task[];
  onClose: () => void;
  onSaved: (r: SessionResult) => void;
}) {
  const { t, lang } = useT();
  const [queue, setQueue] = useState<Task[]>(first);
  const [i, setI] = useState(0);
  const [given, setGiven] = useState<{ task: Task; given: Given }[]>([]);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [retried, setRetried] = useState(0);
  const [comesBack, setComesBack] = useState(false);
  const [text, setText] = useState('');
  const [order, setOrder] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SessionResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const task = queue[i];
  const done = i >= queue.length;

  const answer = (g: Given) => {
    if (checked || !task) return;
    const c = checkTask(task, g, verbs);
    if (!c) return;
    setChecked(c);
    setGiven((list) => [...list, { task, given: g }]);
    const back = !c.ok && !!taskVerb(task, verbs) && retried < MAX_RETRIES;
    setComesBack(back);
    if (back) {
      setRetried((n) => n + 1);
      setQueue((q) => [...q.slice(0, retryAt(i, q.length)), task, ...q.slice(retryAt(i, q.length))]);
    }
  };

  const finish = async (answers = given) => {
    setSaving(true);
    setError('');
    try {
      const r = await saveSession(answers);
      goal('grammar_done', { right: r.outcome.right, answered: r.outcome.answered });
      setResult(r);
      onSaved(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    setChecked(null);
    setText('');
    setOrder([]);
    setComesBack(false);
    if (i + 1 >= queue.length) void finish();
    setI((n) => n + 1);
    requestAnimationFrame(() => input.current?.focus());
  };

  const submitText = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) answer(text);
  };
  const typeLetter = (l: string) => {
    const el = input.current;
    if (!el) return setText((s) => s + l);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + l + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  };

  const verb = task && (task.type === 'partizip' || task.type === 'aux') ? verbs.find((v) => v.id === task.verb) : undefined;
  const s = task?.type === 'order' ? sentence(task.id) : undefined;
  const tf = task?.type === 'transform' ? transform(task.id) : undefined;
  const tiles = useMemo(() => (s ? shuffled(s.tiles.length + 1, s.id) : []), [s]);

  // Mid-session, closing loses the answers: it takes a second tap
  const closeButton = given.length && !result ? (
    <ConfirmButton className="icon-btn gr-close" confirmLabel={t('Stop? Tap again')} onConfirm={onClose}><Icon name="x" /></ConfirmButton>
  ) : undefined;

  /* ---------- the end of the session ---------- */
  if (done) {
    const o = result?.outcome;
    const changed = o ? RULES.filter((r) => o.before[r] !== o.after[r] && o.after[r] !== null) : [];
    const missed = o ? o.missed.map((id) => verbs.find((v) => v.id === id)).filter((v): v is Verb => !!v) : [];
    return (
      <Screen title="Perfekt" sub={t('Your result')} onClose={onClose} closeLabel={t('Close')} progress={1}
        foot={result ? (
          <>
            <button className="btn" onClick={onClose}>{t('Done')}</button>
            <button className="btn btn-primary" onClick={() => {
              goal('grammar_start', { again: true });
              setQueue(result.tasks);
              setI(0);
              setGiven([]);
              setRetried(0);
              setResult(null);
            }}><Icon name="undo" /> {t('Practise again')}</button>
          </>
        ) : error ? (
          <button className="btn btn-primary" onClick={() => void finish()} disabled={saving}>{t('Try again')}</button>
        ) : undefined}>
        {!result ? (
          <div className="panel" aria-busy={saving}>
            {error ? <p className="err" role="alert">{t(error)}</p> : <p>{t('Saving…')}</p>}
          </div>
        ) : (
          <>
            <section className="gr-score" aria-live="polite">
              <b>{o!.right}<span className="muted">/{o!.answered}</span></b>
              <span>{t('right')}</span>
            </section>
            {changed.length > 0 && (
              <section className="panel">
                <h2 className="gr-h">{t('Your rules')}</h2>
                <ul className="gr-changes">
                  {changed.map((r) => {
                    const before = o!.before[r];
                    const after = o!.after[r]!;
                    const up = before === null || after >= before;
                    return (
                      <li key={r}>
                        <span>{t(RULE_TEXT[r].label)}</span>
                        <b className={up ? 'ok-text' : 'gr-down'}>
                          {before === null ? '' : `${Math.round(before * 100)}% → `}{Math.round(after * 100)}% {up ? '↑' : '↓'}
                        </b>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {missed.length > 0 && (
              <section className="panel">
                <h2 className="gr-h">{t('Verbs to repeat')}</h2>
                <ul className="gr-missed">{missed.map((v) => <li key={v.id}><VerbForms verb={v} /> <span className="muted small">{v.meaning}</span></li>)}</ul>
                <p className="muted small">{t('They come back in your next sessions until you know them.')}</p>
              </section>
            )}
            <p className="muted small"><Icon name="flame" /> {t('Your answers count for your streak.')}</p>
          </>
        )}
      </Screen>
    );
  }

  /* ---------- one task ---------- */
  const kind = task.type === 'partizip' ? 'Partizip II' : task.type === 'aux' ? t('haben or sein?') : task.type === 'order' ? t('Build the sentence') : t('Präsens → Perfekt');
  return (
    <Screen title="Perfekt" sub={`${Math.min(i + 1, queue.length)} / ${queue.length}`} onClose={onClose} closeLabel={t('Close')} progress={i / queue.length}
      closeButton={closeButton}
      foot={checked ? <button className="btn btn-primary" onClick={next} autoFocus>{i + 1 >= queue.length ? t('See my result') : t('Next')} <Icon name="next" /></button> : undefined}>
      <p className="eyebrow">{kind}</p>

      {task.type === 'partizip' && verb && (
        <form className="gr-task" onSubmit={submitText}>
          <p className="gr-prompt"><span lang="de">{verb.inf}</span> <span className="muted gr-mean">({verb.meaning})</span></p>
          <label className="gr-line" lang="de">
            <span className="gr-aux">{verb.aux === 'sein' ? 'ist' : 'hat'}</span>
            <input ref={input} className="gr-input ym-disable-keys" value={text} onChange={(e) => setText(e.target.value)} disabled={!!checked}
              placeholder="ge…" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} lang="de" autoFocus
              aria-label={t('The Partizip II of {verb}', { verb: verb.inf })} />
          </label>
          {!checked && <Umlauts onType={typeLetter} />}
          {!checked && <button className="btn btn-primary btn-xl" disabled={!text.trim()}>{t('Check')}</button>}
        </form>
      )}

      {task.type === 'aux' && verb && (
        <div className="gr-task">
          <p className="gr-prompt"><span lang="de">{verb.inf}</span> <span className="muted gr-mean">({verb.meaning})</span></p>
          <p className="gr-line" lang="de">Er <span className="gr-gap">{checked ? (checked.right === 'sein' ? 'ist' : 'hat') : '___'}</span> {verb.p}.</p>
          {!checked && (
            <div className="gr-choices">
              <button className="btn btn-xl" lang="de" onClick={() => answer('haben')}>hat <span className="muted small">(haben)</span></button>
              <button className="btn btn-xl" lang="de" onClick={() => answer('sein')}>ist <span className="muted small">(sein)</span></button>
            </div>
          )}
        </div>
      )}

      {task.type === 'order' && s && (
        <div className="gr-task">
          <p className="muted">{t('Tap the words in order. One of the helper verbs is extra.')}</p>
          {lang === 'uz' && <p className="gr-mean">{s.uz}</p>}
          <div className="gr-built" aria-live="polite" lang="de">
            {order.length ? order.map((idx, k) => (
              <button key={k} className="gr-tile is-placed" disabled={!!checked} onClick={() => setOrder(order.filter((_, j) => j !== k))}>
                {k === 0 ? (idx === s.tiles.length ? s.wrongAux : s.tiles[idx].w).replace(/^./, (c) => c.toUpperCase()) : idx === s.tiles.length ? s.wrongAux : s.tiles[idx].w}
              </button>
            )) : <span className="muted small">{t('Your sentence appears here.')}</span>}
          </div>
          {!checked && (
            <>
              <div className="gr-pool" lang="de">
                {tiles.map((idx) => (
                  <button key={idx} className="gr-tile" disabled={order.includes(idx)} onClick={() => setOrder([...order, idx])}>
                    {idx === s.tiles.length ? s.wrongAux : s.tiles[idx].w}
                  </button>
                ))}
              </div>
              <div className="btn-row">
                <button className="btn" onClick={() => setOrder([])} disabled={!order.length}>{t('Start over')}</button>
                <button className="btn btn-primary" onClick={() => answer(order)} disabled={order.length < s.tiles.length}>{t('Check')}</button>
              </div>
            </>
          )}
        </div>
      )}

      {task.type === 'transform' && tf && (
        <form className="gr-task" onSubmit={submitText}>
          <p className="muted">{t('Write this sentence in the Perfekt.')}</p>
          <p className="gr-prompt" lang="de">{tf.present}</p>
          <input ref={input} className="gr-input is-wide ym-disable-keys" value={text} onChange={(e) => setText(e.target.value)} disabled={!!checked}
            placeholder={t('The sentence in the Perfekt')} autoComplete="off" autoCapitalize="sentences" autoCorrect="off" spellCheck={false} lang="de" autoFocus
            aria-label={t('The sentence in the Perfekt')} />
          {!checked && <Umlauts onType={typeLetter} />}
          {!checked && <button className="btn btn-primary btn-xl" disabled={!text.trim()}>{t('Check')}</button>}
        </form>
      )}

      {checked && <Feedback checked={checked} task={task} verbs={verbs} built={s ? writeOrder(s, order) : ''} comesBack={comesBack} />}
    </Screen>
  );
}

function Umlauts({ onType }: { onType: (l: string) => void }) {
  const { t } = useT();
  return (
    <div className="gr-umlauts" role="group" aria-label={t('German letters')}>
      {UMLAUTS.map((l) => (
        <button key={l} type="button" className="btn btn-sm" lang="de" onMouseDown={(e) => e.preventDefault()} onClick={() => onType(l)}
          aria-label={t('Type {letter}', { letter: l })}>{l}</button>
      ))}
    </div>
  );
}

/** Right or not, the rule behind it, and the right answer. */
function Feedback({ checked, task, verbs, built, comesBack }: { checked: Checked; task: Task; verbs: Verb[]; built: string; comesBack: boolean }) {
  const { t } = useT();
  const verb = taskVerb(task, verbs);
  const showForms = verb && (task.type === 'partizip' || task.type === 'aux' || (task.type === 'transform' && !checked.ok && checked.rule !== 'aux'));
  return (
    <section className={`gr-feedback${checked.ok ? ' is-ok' : ' is-wrong'}`} role="status">
      <p className="gr-verdict">
        <Icon name={checked.ok ? 'check' : 'x'} /> {checked.ok ? t('Right!') : t('Not quite.')}
      </p>
      {checked.ok && checked.hint === 'umlaut' && <p>{t('Mind the umlaut:')} <b lang="de">{checked.right}</b></p>}
      {checked.ok && checked.hint === 'order' && <p>{t('The usual order:')} <b lang="de">{checked.right.replace(/^./, (c) => c.toUpperCase())}.</b></p>}
      {!checked.ok && (
        <>
          <p className="gr-why">{checked.code === 'wrong' && checked.rule && checked.rule !== 'aux' ? `${t(RULE_TEXT[checked.rule].label)}: ${RULE_TEXT[checked.rule].example}` : t(FEEDBACK[checked.code].text)}</p>
          {task.type === 'order' && built && <p className="muted"><s lang="de">{built}</s></p>}
          <p>
            {t('Right answer:')}{' '}
            {task.type === 'partizip' && verb ? <Partizip verb={verb} />
              : task.type === 'aux' ? <b lang="de">{checked.right === 'sein' ? 'ist' : 'hat'}</b>
              : <Bracket text={markBracket(checked.right)} />}
          </p>
        </>
      )}
      {showForms && verb && <p className="muted small"><VerbForms verb={verb} /> · {verb.meaning}</p>}
      {comesBack && <p className="muted small"><Icon name="undo" /> {t('This one comes back in a moment.')}</p>}
    </section>
  );
}

/** Box the helper verb and the Partizip of a sentence: "Er [hat] … [gespielt]." */
function markBracket(sentenceText: string): string {
  const words = sentenceText.replace(/\.$/, '').split(' ');
  const auxAt = words.findIndex((w) => /^(habe|hast|hat|haben|habt|bin|bist|ist|sind|seid)$/.test(w));
  const out = words.map((w, k) => (k === auxAt || k === words.length - 1 ? `[${w}]` : w)).join(' ');
  return `${out.charAt(0).toUpperCase()}${out.slice(1)}.`;
}
