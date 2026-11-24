'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocalState } from '@/lib/client/hooks';
import { BOOKS, lektionNumber } from '@/lib/books';
import { buildCrossword, crosswordWord, fold, gridCells, MIN_WORDS, type Crossword } from '@/lib/crossword';
import { highlightParts } from '@/lib/text';
import type { Word } from '@/lib/types';

type Dir = 'across' | 'down';
/** Overlays go to the page root: the dashboard's entrance animation would otherwise trap `position: fixed` inside it. */
const Overlay = ({ children }: { children: ReactNode }) => createPortal(children, document.querySelector('.wf') ?? document.body);
const isStrings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/* ---------- the card on the course page, the lesson picker, and the game ---------- */
export function CrosswordCard({ words }: { words: Map<string, Word> }) {
  const [saved, setSaved] = useLocalState<string[]>('wf.crossLessons', [], isStrings);
  const [pick, setPick] = useState(false);
  const [game, setGame] = useState<Crossword | null>(null);
  const [err, setErr] = useState('');

  // The lessons that have words for a crossword, with how many each can give.
  const lessons = useMemo(() => {
    const m = new Map<string, number>();
    words.forEach((w) => { if (w.deck && lektionNumber(w.deck) !== null && crosswordWord(w.term)) m.set(w.deck, (m.get(w.deck) ?? 0) + 1); });
    return [...m].map(([deck, n]) => ({ deck, n, no: lektionNumber(deck)! })).sort((a, b) => a.no - b.no);
  }, [words]);
  const picked = saved.filter((d) => lessons.some((l) => l.deck === d));
  const chosen = picked.length ? picked : lessons.slice(-2).map((l) => l.deck); // the last two lessons by default

  const toggle = (deck: string) => setSaved(chosen.includes(deck) ? chosen.filter((d) => d !== deck) : [...chosen, deck]);
  const start = () => {
    const pool = [...words.values()].filter((w) => chosen.includes(w.deck));
    const cw = buildCrossword(pool, Date.now());
    if (!cw) return setErr(`Not enough words for a crossword (need ${MIN_WORDS}). Pick one more lesson.`);
    setErr('');
    setPick(false);
    setGame(cw);
  };

  if (!lessons.length) return null;
  return (
    <>
      <section className="panel cw-card" aria-labelledby="cw-h">
        <div className="sec-head"><h2 id="cw-h">Crossword</h2><span className="label">Game</span></div>
        <p className="note">Pick two or three lessons and solve a crossword from their words. Clues are Uzbek, answers are German.</p>
        <button className="btn-lime" style={{ alignSelf: 'flex-start' }} onClick={() => setPick(true)}>Play crossword</button>
      </section>

      {pick && (
        <Overlay><div className="sheet-bg" onClick={() => setPick(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Pick lessons">
            <h2>Which lessons?</h2>
            <span className="note">Pick two or three. The crossword uses their words.</span>
            {BOOKS.map((b) => {
              const list = lessons.filter((l) => l.no >= b.from && l.no <= b.to);
              return list.length > 0 && (
                <div key={b.name} className="cw-group">
                  <span className="label">{b.name}</span>
                  <div className="cw-chips">
                    {list.map((l) => (
                      <button key={l.deck} className="cw-chip" aria-pressed={chosen.includes(l.deck)} onClick={() => toggle(l.deck)}>
                        {l.deck} <small>{l.n}</small>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {err && <span className="note" role="alert" style={{ color: '#ff8a8a' }}>{err}</span>}
            <button className="btn-lime" style={{ justifyContent: 'center' }} disabled={!chosen.length} onClick={start}>
              Start crossword · {chosen.length} {chosen.length === 1 ? 'lesson' : 'lessons'}
            </button>
          </div>
        </div></Overlay>
      )}

      {game && <Overlay><Game key={game.entries.map((e) => e.answer).join()} cw={game} onClose={() => setGame(null)} onAgain={start} /></Overlay>}
    </>
  );
}

function Game({ cw, onClose, onAgain }: { cw: Crossword; onClose: () => void; onAgain: () => void }) {
  const cells = useMemo(() => gridCells(cw), [cw]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const first = cw.entries[0];
  const [sel, setSel] = useState<{ key: string; dir: Dir }>({ key: `${first.row},${first.col}`, dir: first.dir });
  const input = useRef<HTMLInputElement>(null);

  const keyAt = (e: (typeof cw.entries)[number], k: number) => `${e.row + (e.dir === 'down' ? k : 0)},${e.col + (e.dir === 'across' ? k : 0)}`;
  const here = cells.get(sel.key)!;
  const activeIdx = here.entries.find((i) => cw.entries[i].dir === sel.dir) ?? here.entries[0];
  const active = cw.entries[activeIdx];
  const pos = Array.from({ length: active.answer.length }, (_, k) => keyAt(active, k)).indexOf(sel.key);
  const solved = [...cells].filter(([k, c]) => typed[k] === c.ch).length;
  const done = solved === cells.size;
  const hintsUsed = Object.values(hints).reduce((a, b) => a + b, 0);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const select = (key: string, wanted?: Dir) => {
    const dirs = cells.get(key)!.entries.map((i) => cw.entries[i].dir);
    let dir = wanted ?? sel.dir;
    if (!wanted && key === sel.key && dirs.length > 1) dir = dir === 'across' ? 'down' : 'across'; // tap again: turn the word
    else if (!dirs.includes(dir)) dir = dirs[0];
    setSel({ key, dir });
    input.current?.focus();
  };
  const selectEntry = (i: number) => { const e = cw.entries[i]; setSel({ key: keyAt(e, 0), dir: e.dir }); input.current?.focus(); };
  const set = (key: string, ch: string) => { setChecked(false); setTyped((t) => ({ ...t, [key]: ch })); };

  const onType = (raw: string) => {
    const ch = fold(raw.slice(-1));
    if (done || !/^[A-Z]$/.test(ch)) return;
    set(sel.key, ch);
    if (pos < active.answer.length - 1) setSel({ key: keyAt(active, pos + 1), dir: active.dir });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (typed[sel.key]) set(sel.key, '');
      else if (pos > 0) { const k = keyAt(active, pos - 1); set(k, ''); setSel({ key: k, dir: active.dir }); }
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const [r, c] = sel.key.split(',').map(Number);
      const [dr, dc] = e.key === 'ArrowUp' ? [-1, 0] : e.key === 'ArrowDown' ? [1, 0] : e.key === 'ArrowLeft' ? [0, -1] : [0, 1];
      const next = `${r + dr},${c + dc}`;
      if (cells.has(next)) select(next, dr ? 'down' : 'across');
    }
  };

  const hint = () => {
    const level = hints[activeIdx] ?? 0;
    if (level >= 2) return;
    setHints((h) => ({ ...h, [activeIdx]: level + 1 }));
    if (level === 0) set(keyAt(active, 0), active.answer[0]);
  };
  const reveal = () => {
    setChecked(false);
    setTyped((t) => ({ ...t, ...Object.fromEntries(Array.from(active.answer, (ch, k) => [keyAt(active, k), ch])) }));
  };

  const example = (() => {
    const w = active.word;
    if (!w.example || (hints[activeIdx] ?? 0) < 2) return '';
    return highlightParts(w.example, w.term).map((p) => (p.mark ? '_____' : p.text)).join('');
  })();
  const clue = (i: number) => {
    const e = cw.entries[i];
    return (
      <button key={i} className={`cw-clue${i === activeIdx ? ' on' : ''}`} onClick={() => selectEntry(i)}>
        <b>{e.num}</b><span>{e.word.meaning}</span><small>{e.answer.length}</small>
      </button>
    );
  };

  return (
    <div className="stage cw" role="dialog" aria-modal="true" aria-label="Crossword" onClick={() => input.current?.focus()}>
      <div className="stage-top">
        <button className="round" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <b className="cw-title">Crossword</b>
        <span className="cw-count">{solved} / {cells.size}</span>
      </div>

      <div className="cw-scroll">
        <input ref={input} className="cw-input" value="" onChange={(e) => onType(e.target.value)} onKeyDown={onKeyDown}
          autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} aria-label="Type the letter" />

        {done ? (
          <div className="cw-done" role="status">
            <b>Crossword complete!</b>
            <span className="note">{cw.entries.length} words{hintsUsed ? ` · ${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'}` : ' · no hints'}</span>
            <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn-lime" onClick={onAgain}>New crossword</button>
              <button className="btn-ghost" style={{ border: '1px solid var(--line)' }} onClick={onClose}>Back</button>
            </span>
          </div>
        ) : (
          <div className="cw-now" aria-live="polite">
            <span className="label">{active.num} {active.dir === 'across' ? 'Across' : 'Down'} · {active.answer.length} letters</span>
            <b>{active.word.meaning}</b>
            {example && <span className="note">{example}</span>}
            <span className="cw-tools">
              <button className="mini" onClick={hint} disabled={(hints[activeIdx] ?? 0) >= 2}>{(hints[activeIdx] ?? 0) === 0 ? 'Hint' : 'More hint'}</button>
              <button className="mini ghost" onClick={() => setChecked(true)}>Check</button>
              <button className="mini ghost" onClick={reveal}>Reveal word</button>
            </span>
          </div>
        )}

        <div className="cw-grid" style={{ gridTemplateColumns: `repeat(${cw.cols}, var(--cs))`, ['--cs' as string]: `min(40px, calc((min(100vw, 520px) - 40px - ${(cw.cols - 1) * 3}px) / ${cw.cols}))` }}>
          {Array.from({ length: cw.rows * cw.cols }, (_, n) => {
            const key = `${Math.floor(n / cw.cols)},${n % cw.cols}`;
            const cell = cells.get(key);
            if (!cell) return <i key={key} className="cw-blank" />;
            const v = typed[key] ?? '';
            const cls = ['cw-cell', key === sel.key ? 'sel' : cell.entries.includes(activeIdx) ? 'word' : '', checked && v && v !== cell.ch ? 'bad' : '', v && v === cell.ch ? 'ok' : ''].join(' ');
            return (
              <button key={key} className={cls} onClick={() => select(key)} aria-label={`Row ${cell.r + 1}, column ${cell.c + 1}${v ? `, ${v}` : ''}`}>
                {cell.num > 0 && <small>{cell.num}</small>}
                {v === cell.ch ? cell.disp : v}
              </button>
            );
          })}
        </div>

        <div className="cw-lists">
          <div><span className="label">Across</span>{cw.entries.map((e, i) => e.dir === 'across' && clue(i))}</div>
          <div><span className="label">Down</span>{cw.entries.map((e, i) => e.dir === 'down' && clue(i))}</div>
        </div>
      </div>
    </div>
  );
}
