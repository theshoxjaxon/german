'use client';

import Link from 'next/link';
import { Fragment, useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import { useNow } from '@/lib/client/hooks';
import { speak, stopSpeech } from '@/lib/client/speech';
import { store, useStore } from '@/lib/client/store';
import { buildQueue, lapsesOf, LEECH_AT, nextDueSummary, pickNext, srsConfig, type QueueItem } from '@/lib/queue';
import { answer, preview } from '@/lib/srs';
import { genderOf, highlightParts, termSizeClass } from '@/lib/text';
import { dayIndex, dayLong, fmtSpan, MIN, plural } from '@/lib/time';
import { POS_LABEL, RATING_LABEL, RATINGS, type CardDoc, type Rating } from '@/lib/types';
import { Icon, SpeakButton, Term } from './ui';
import { useUI } from './ui-context';

interface UndoEntry {
  id: string;
  prevDoc: CardDoc | null;
  item: QueueItem;
  wasAgain: boolean;
}

/** Full-screen, distraction-free study mode. */
export function ReviewSession({ first, startedAt, onClose }: { first: QueueItem | null; startedAt: number; onClose: () => void }) {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const [current, setCurrent] = useState<QueueItem | null>(first);
  const [deal, setDeal] = useState(0); // bumps for every card shown, so the card remounts unflipped
  const [flipped, setFlipped] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [tally, setTally] = useState({ answered: 0, again: 0 });

  function showNext() {
    const t = Date.now();
    const snap = store.getSnapshot();
    const next = pickNext(buildQueue(snap, t), t);
    setFlipped(false);
    setCurrent(next);
    setDeal((d) => d + 1);
    if (next && snap.prefs.autoplay && next.dir === 'f') speak(next.word.term, snap.prefs.ttsLang);
  }

  function flip(to = !flipped) {
    if (!current) return;
    setFlipped(to);
    if (to && data.prefs.autoplay && current.dir === 'r') speak(current.word.term, data.prefs.ttsLang);
  }

  function rate(rating: Rating) {
    if (!current || !flipped) return;
    const t = Date.now();
    const snap = store.getSnapshot();
    const id = current.word.id;
    const prevDoc = snap.cards.get(id) ?? null;
    const next = answer(prevDoc?.[current.dir] ?? null, rating, t, srsConfig(snap.prefs), current.key);
    const doc: CardDoc = { f: prevDoc?.f ?? null, r: prevDoc?.r ?? null, suspended: !!prevDoc?.suspended, updatedAt: t };
    doc[current.dir] = next;
    setUndoStack((u) => [...u.slice(-29), { id, prevDoc, item: current, wasAgain: rating === 'again' }]);
    setTally((s) => ({ answered: s.answered + 1, again: s.again + (rating === 'again' ? 1 : 0) }));
    void store.saveCard(id, doc);
    if (rating === 'again' && next.lapses === LEECH_AT) ui.toast(`“${current.word.term}” is a leech. Give it a memory hook.`);
    try {
      navigator.vibrate?.(8);
    } catch {
      /* not supported */
    }
    showNext();
  }

  function undo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((u) => u.slice(0, -1));
    setTally((s) => ({ answered: Math.max(0, s.answered - 1), again: Math.max(0, s.again - (last.wasAgain ? 1 : 0)) }));
    void store.saveCard(last.id, last.prevDoc);
    const word = store.getSnapshot().words.get(last.id);
    if (!word) return showNext();
    setCurrent({ ...last.item, word, s: last.prevDoc?.[last.item.dir] ?? null });
    setFlipped(false);
    setDeal((d) => d + 1);
    ui.toast('Answer undone');
  }

  // Keyboard: Space/Enter flips (then = Good), 1–4 rate, Z undoes, P plays the word, Esc ends.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const onButton = !!t?.closest('button');
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if ((e.key === ' ' || e.key === 'Enter') && !onButton && current) {
      e.preventDefault();
      if (flipped) rate('good');
      else flip(true);
    } else if (flipped && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      rate(RATINGS[+e.key - 1]);
    } else if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key.toLowerCase() === 'p' && current) {
      e.preventDefault();
      speak(current.word.term, data.prefs.ttsLang);
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Keep the screen on while studying, where the browser allows it.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const l = await navigator.wakeLock?.request('screen');
        if (cancelled) void l?.release();
        else lock = l ?? null;
      } catch {
        /* refused: fine */
      }
    };
    void request();
    const onVisible = () => {
      if (!document.hidden && (!lock || lock.released)) void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
      stopSpeech();
    };
  }, []);

  const counts = now ? buildQueue(data, now).counts : { fresh: 0, learning: 0, review: 0 };
  const left = counts.fresh + counts.learning + counts.review;
  const progress = tally.answered + left ? (tally.answered / (tally.answered + left)) * 100 : 100;
  const kind = !current ? '' : !current.s || current.s.type === 'new' ? 'new' : current.s.type === 'review' ? 'due' : 'learn';

  return (
    <div className="review" role="dialog" aria-modal="true" aria-label="Review session">
      <div className="rv-top">
        <button className="icon-btn" onClick={onClose} aria-label="End session"><Icon name="x" /></button>
        <div className="rv-counts" aria-label="Cards left">
          <span className={`rc${kind === 'new' ? ' is-cur' : ''}`} title="New"><i className="dot k-new" />{counts.fresh}</span>
          <span className={`rc${kind === 'learn' ? ' is-cur' : ''}`} title="Learning"><i className="dot k-learn" />{counts.learning}</span>
          <span className={`rc${kind === 'due' ? ' is-cur' : ''}`} title="To review"><i className="dot k-due" />{counts.review}</span>
        </div>
        <button className="icon-btn" onClick={undo} aria-label="Undo last answer" disabled={!undoStack.length}><Icon name="undo" /></button>
      </div>
      <div className="rv-bar"><i style={{ width: `${progress}%` }} /></div>

      {current ? (
        <>
          <div className="rv-stage">
            <Flashcard key={deal} item={current} flipped={flipped} onFlip={() => flip()} onSwipe={rate} />
          </div>
          <div className="rv-actions">
            {flipped ? (
              <RatingButtons item={current} now={now} onRate={rate} />
            ) : (
              <>
                <button className="btn btn-primary btn-xl" onClick={() => flip(true)}>Show answer</button>
                <p className="rv-hint">Tap the card to turn it over</p>
              </>
            )}
          </div>
        </>
      ) : (
        <DoneScreen answered={tally.answered} again={tally.again} startedAt={startedAt} now={now} onClose={onClose} onMore={showNext} />
      )}
    </div>
  );
}

function RatingButtons({ item, now, onRate }: { item: QueueItem; now: number; onRate: (r: Rating) => void }) {
  const { prefs } = useStore();
  const pv = preview(item.s, now, srsConfig(prefs), item.key);
  return (
    <>
      <div className="ratings" role="group" aria-label="How well did you remember it?">
        {RATINGS.map((r, i) => (
          <button key={r} className={`rate r-${r}`} onClick={() => onRate(r)} aria-keyshortcuts={String(i + 1)}>
            <span className="rate-ivl">{fmtSpan(pv[r])}</span>
            <span className="rate-label">{RATING_LABEL[r]}</span>
          </button>
        ))}
      </div>
      <p className="rv-hint">Swipe the card left for Again, right for Good</p>
    </>
  );
}

/**
 * The index card. Tap = flip. On the answer side, a horizontal swipe rates it:
 * left = Again, right = Good. touch-action: pan-y keeps vertical scrolling native.
 */
function Flashcard({ item, flipped, onFlip, onSwipe }: { item: QueueItem; flipped: boolean; onFlip: () => void; onSwipe: (r: Rating) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; dx: number; mode: 'swipe' | 'scroll' | null } | null>(null);
  const flying = useRef(false);

  // Each new card takes keyboard focus, so Space and 1–4 act on it (not on the button clicked last).
  useEffect(() => cardRef.current?.focus({ preventScroll: true }), []);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target as HTMLElement).closest('button') || flying.current) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, mode: null };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const card = cardRef.current;
    const stamp = stampRef.current;
    if (!d || e.pointerId !== d.id || !card || !stamp) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.mode) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        d.mode = 'swipe';
        card.setPointerCapture(e.pointerId);
        card.classList.remove('deal');
        card.classList.add('dragging');
      } else if (Math.abs(dy) > 8) {
        d.mode = 'scroll';
        return;
      } else return;
    }
    if (d.mode !== 'swipe') return;
    d.dx = flipped ? dx : dx * 0.18; // the question side only wiggles
    card.style.transform = `translateX(${d.dx}px) rotate(${d.dx / 24}deg)`;
    if (flipped) {
      const r: Rating = d.dx < 0 ? 'again' : 'good';
      stamp.textContent = RATING_LABEL[r];
      stamp.className = `stamp s-${r}`;
      stamp.style.opacity = String(Math.min(1, Math.abs(d.dx) / 110));
    }
  };
  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove('dragging');
    if (d.mode === 'swipe') {
      if (!cancelled && flipped && Math.abs(d.dx) > 90) {
        const r: Rating = d.dx < 0 ? 'again' : 'good';
        const dir = r === 'again' ? -1 : 1;
        flying.current = true;
        card.style.transition = 'transform .22s ease-in, opacity .22s ease-in';
        card.style.transform = `translateX(${dir * window.innerWidth}px) rotate(${dir * 16}deg)`;
        card.style.opacity = '0';
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(() => onSwipe(r), reduce ? 0 : 200);
      } else {
        card.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)';
        card.style.transform = '';
        if (stampRef.current) stampRef.current.style.opacity = '0';
        setTimeout(() => {
          card.style.transition = '';
        }, 260);
      }
    } else if (!d.mode && !cancelled) onFlip();
  };

  return (
    <div
      ref={cardRef}
      className={`flip deal${flipped ? ' is-flipped' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Flashcard. Tap to turn it over."
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
    >
      <div className="flip-inner">
        <article className="face front" aria-hidden={flipped}>
          <FrontFace item={item} />
        </article>
        <article className="face back" aria-hidden={!flipped}>
          <BackFace item={item} />
        </article>
      </div>
      <div className="stamp" ref={stampRef} aria-hidden="true" />
    </div>
  );
}

function FaceHead({ item, showGender }: { item: QueueItem; showGender: boolean }) {
  const w = item.word;
  const g = genderOf(w.term);
  const pos = (POS_LABEL[w.pos] || '').toLowerCase();
  const isNew = !item.s || item.s.type === 'new';
  return (
    <div className="face-head">
      {showGender && g ? (
        <span className={`gchip g-${g}`}>{g}{pos ? ` · ${pos}` : ''}</span>
      ) : pos ? (
        <span className="gchip">{pos}</span>
      ) : null}
      {isNew && <span className="new-flag">New</span>}
      <span className="face-deck">{w.deck}{item.dir === 'r' ? ' · production' : ''}</span>
    </div>
  );
}

function FrontFace({ item }: { item: QueueItem }) {
  const w = item.word;
  if (item.dir === 'r') {
    // Production card: no gender hint on the question side.
    return (
      <>
        <FaceHead item={item} showGender={false} />
        <div className="face-main">
          <p className="prompt">In German?</p>
          <p className="meaning-xl">{w.meaning}</p>
        </div>
        <p className="face-foot">Say it out loud, then tap to check</p>
      </>
    );
  }
  return (
    <>
      <FaceHead item={item} showGender />
      <div className="face-main">
        <p className={`term-xl ${termSizeClass(w.term)}`} lang="de"><Term term={w.term} /></p>
        <SpeakButton text={w.term} />
      </div>
      <p className="face-foot">Tap to reveal</p>
    </>
  );
}

function BackFace({ item }: { item: QueueItem }) {
  const { cards } = useStore();
  const w = item.word;
  const leech = lapsesOf(cards.get(w.id)) >= LEECH_AT;
  return (
    <>
      <FaceHead item={item} showGender />
      <div className="back-body">
        <div className="back-term">
          <p className="term-lg" lang="de"><Term term={w.term} /></p>
          <SpeakButton text={w.term} />
        </div>
        {w.pronunciation && <p className="ipa">{w.pronunciation}</p>}
        <p className="meaning-lg">{w.meaning}</p>
        {w.forms && (
          <div className="forms">
            <span className="lbl">Forms</span>
            <span lang="de">{w.forms}</span>
          </div>
        )}
        {w.example && (
          <figure className="example">
            <blockquote lang="de">
              {highlightParts(w.example, w.term).map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>))}{' '}
              <SpeakButton text={w.example} small />
            </blockquote>
            {w.exampleTr && <figcaption>{w.exampleTr}</figcaption>}
          </figure>
        )}
        {w.mnemonic ? (
          <div className="hook">
            <p className="lbl">Memory hook</p>
            <p>{w.mnemonic}</p>
          </div>
        ) : leech ? (
          <div className="hook is-missing">You keep forgetting this word. Add a memory hook in Words.</div>
        ) : null}
        {w.notes && <p className="note">{w.notes}</p>}
      </div>
    </>
  );
}

function DoneScreen({ answered, again, startedAt, now, onClose, onMore }: {
  answered: number;
  again: number;
  startedAt: number;
  now: number;
  onClose: () => void;
  onMore: () => void;
}) {
  const data = useStore();
  const t = Math.max(now, startedAt);
  const q = buildQueue(data, t);
  const nx = nextDueSummary(data, t);
  const today = dayIndex(t);
  const mins = Math.max(1, Math.round((t - startedAt) / MIN));
  const pct = answered ? Math.round((100 * (answered - again)) / answered) : 0;
  let next = '';
  if (nx.soonest) next = `${plural(q.learning.length, 'card is', 'cards are')} still in learning and ${q.learning.length === 1 ? 'comes' : 'come'} back in ${fmtSpan(nx.soonest - t)}.`;
  else if (nx.day != null) next = `Next reviews ${nx.day === today + 1 ? 'tomorrow' : 'on ' + dayLong(nx.day)}: ${plural(nx.count, 'card', 'cards')}.`;
  const canLearnMore = q.fresh.length > 0 && q.newLeft === 0;
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => doneRef.current?.focus({ preventScroll: true }), []);

  const learnMore = () => {
    const prev = data.prefs.bonusNew?.day === today ? data.prefs.bonusNew.n : 0;
    store.setPrefs({ bonusNew: { day: today, n: prev + 10 } }, true);
    onMore();
  };

  return (
    <>
      <div className="rv-stage">
        <section className="done" aria-live="polite">
          <p className="eyebrow" lang="de">Fertig!</p>
          <h2>{answered ? 'Done for now' : 'Nothing to study right now'}</h2>
          {answered > 0 && (
            <div className="done-stats">
              <div><b>{answered}</b><span>answers</span></div>
              <div><b>{pct}%</b><span>remembered</span></div>
              <div><b>{mins}</b><span>{mins === 1 ? 'minute' : 'minutes'}</span></div>
            </div>
          )}
          {next && <p>{next}</p>}
          {canLearnMore && <button className="btn" onClick={learnMore}>Learn 10 more new words</button>}
          {data.guest && answered > 0 && (
            <p className="done-nudge">
              <Link href="/signup">Create a free profile</Link> to keep this progress and start a streak.
            </p>
          )}
        </section>
      </div>
      <div className="rv-actions">
        <button className="btn btn-primary btn-xl" onClick={onClose} ref={doneRef}>Back to the box</button>
        <p className="rv-hint" />
      </div>
    </>
  );
}
