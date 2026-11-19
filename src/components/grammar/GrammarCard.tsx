'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { fetchPerfekt, type PerfektData } from '@/lib/client/grammar';
import { goal } from '@/lib/client/metrica';
import { RULES } from '@/lib/grammar/perfekt';
import { Icon } from '../ui';
import { PerfektTrainer } from './PerfektTrainer';
import { RuleSheet } from './RuleSheet';
import { RuleBar } from './shared';
import { WritingCheck } from './WritingCheck';

/**
 * Tests → A1.1 → Grammatik: the Perfekt. A bar for each rule (the share right in its last 10
 * answers), and the three ways to get better: practise (short tasks with feedback on the rule),
 * read the rules, and write freely with the AI checking.
 */
export function GrammarCard({ active }: { active: boolean }) {
  const { t, tn } = useT();
  const [data, setData] = useState<PerfektData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<'train' | 'rules' | 'write' | null>(null);

  // Loaded when the Tests tab is open (again each time, so the verbs due today are current)
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetchPerfekt().then((d) => live && (setData(d), setFailed(false)), () => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [active, attempt]);

  const p = data?.progress;
  return (
    <section className="sk gr" aria-labelledby="gr-h">
      <div className="sk-head">
        <h2 id="gr-h"><span lang="de">Grammatik · Perfekt</span> <span className="muted">· {t('the past tense')}</span></h2>
        <p className="muted small">{t('What you did yesterday, in German: haben/sein + Partizip II. Short tasks, the rule behind every mistake, and the verbs you miss come back.')}</p>
      </div>

      {failed && !data ? (
        <div className="btn-row">
          <p className="err">{t('Could not load the grammar practice.')}</p>
          <button className="btn btn-sm" onClick={() => setAttempt((n) => n + 1)}>{t('Try again')}</button>
        </div>
      ) : !data || !p ? (
        <div className="gr-loading" aria-busy="true">{t('Loading…')}</div>
      ) : (
        <>
          <ul className="gr-rules">{RULES.map((r) => <RuleBar key={r} rule={r} results={p.rules[r]} />)}</ul>
          {p.sessions > 0 && (
            <p className="muted small">
              {tn(p.sessions, '{n} session', '{n} sessions')} · {tn(p.seen, '{n} verb practised', '{n} verbs practised')}
              {p.due > 0 && <> · <b>{tn(p.due, '{n} verb to repeat today', '{n} verbs to repeat today')}</b></>}
            </p>
          )}
          <button className="btn btn-primary btn-xl" onClick={() => (goal('grammar_start', { sessions: p.sessions }), setOpen('train'))} disabled={!data.tasks.length}>
            <Icon name="clipboard" /> {t(p.sessions ? 'Practise · 5 min' : 'Start practising · 5 min')}
          </button>
          <div className="btn-row">
            <button className="btn" onClick={() => setOpen('rules')}><Icon name="book" /> {t('The rules')}</button>
            {data.ai && <button className="btn" onClick={() => setOpen('write')}><Icon name="sparkle" /> {t('Write it (AI check)')}</button>}
          </div>
        </>
      )}

      {open === 'train' && data && (
        <PerfektTrainer verbs={data.verbs} tasks={data.tasks} onClose={() => setOpen(null)}
          onSaved={(r) => setData((d) => (d ? { ...d, progress: r.progress, tasks: r.tasks } : d))} />
      )}
      {open === 'rules' && data && <RuleSheet verbs={data.verbs} onClose={() => setOpen(null)} />}
      {open === 'write' && <WritingCheck onClose={() => setOpen(null)} />}
    </section>
  );
}
