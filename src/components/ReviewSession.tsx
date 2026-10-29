'use client';

import Link from 'next/link';
import { Fragment, useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import { useCourseLang } from '@/lib/client/course';
import { useNow } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { langOf, voiceFor } from '@/lib/courses';
import { answersToday } from '@/lib/goal';
import { speak, stopSpeech } from '@/lib/client/speech';
import { store, useStore } from '@/lib/client/store';
import { buildQueue, lapsesOf, LEECH_AT, nextDueSummary, pickNext, quizArticle, srsConfig, type QueueItem } from '@/lib/queue';
import { answer, preview } from '@/lib/srs';
import { ARTICLES, genderOf, highlightParts, splitTerm, termSizeClass, type Article } from '@/lib/text';
import { dayIndex, dayLong, MIN } from '@/lib/time';
import { POS_LABEL, RATING_LABEL, RATINGS, type CardDoc, type Rating } from '@/lib/types';
import { Icon, SpeakButton, Term } from './ui';
import { useUI } from './ui-context';

/** Taps this soon after "Show answer" don't rate the card: a quick double-tap would otherwise rate it unseen. */
const REVEAL_LOCK_MS = 400;

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
  const { t } = useT();
  const lang = useCourseLang();
  const voice = voiceFor(data.prefs.ttsLang, lang);
  const [current, setCurrent] = useState<QueueItem | null>(first);
  const [deal, setDeal] = useState(0); // bumps for every card shown, so the card remounts unflipped
  const [flipped, setFlipped] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [tally, setTally] = useState({ answered: 0, again: 0 });
  const [paused, setPaused] = useState(false); // ✕ mid-session: show the summary before leaving
  const [picked, setPicked] = useState<Article | null>(null); // the der/die/das quiz answer
  const revealedAt = useRef(0);

  function showNext() {
    const t = Date.now();
    const snap = store.getSnapshot();
    const next = pickNext(buildQueue(snap, t), t);
    setFlipped(false);
    setPicked(null);
    setCurrent(next);
    setDeal((d) => d + 1);
    // With the article quiz, read only the noun: the article would give the answer away.
    const l = langOf(snap.course);
    const said = next && (quizArticle(next, snap.prefs, l.articles) ? splitTerm(next.word.term).rest : next.word.term);
    if (next && snap.prefs.autoplay && next.dir === 'f') speak(said || undefined, voiceFor(snap.prefs.ttsLang, l), snap.prefs.slowSpeech);
  }

  function flip(to = !flipped) {
    if (!current) return;
    if (to && !flipped) revealedAt.current = Date.now();
    setFlipped(to);
    const hidden = current.dir === 'r' || !!quizArticle(current, data.prefs, lang.articles); // the full word wasn't heard yet
    if (to && data.prefs.autoplay && hidden) speak(current.word.term, voice, data.prefs.slowSpeech);
  }

  /** The article quiz: pick der, die or das, then see the answer. */
  function pick(art: Article) {
    if (!current || flipped) return;
    setPicked(art);
    flip(true);
  }

  function rate(rating: Rating) {
    if (!current || !flipped || Date.now() - revealedAt.current < REVEAL_LOCK_MS) return;
    const at = Date.now();
    const snap = store.getSnapshot();
    const id = current.word.id;
    const prevDoc = snap.cards.get(id) ?? null;
    const next = answer(prevDoc?.[current.dir] ?? null, rating, at, srsConfig(snap.prefs), current.key);
    const doc: CardDoc = { f: prevDoc?.f ?? null, r: prevDoc?.r ?? null, suspended: !!prevDoc?.suspended, updatedAt: at };
    doc[current.dir] = next;
    setUndoStack((u) => [...u.slice(-29), { id, prevDoc, item: current, wasAgain: rating === 'again' }]);
    setTally((s) => ({ answered: s.answered + 1, again: s.again + (rating === 'again' ? 1 : 0) }));
    void store.saveCard(id, doc);
    if (rating === 'again' && next.lapses === LEECH_AT) ui.toast(t('“{term}” is a leech. Give it a memory hook.', { term: current.word.term }));
    try {
      navigator.vibrate?.(8);
    } catch {
      /* not supported */
    }
    showNext();
  }

  /** ✕ or Esc. After at least one answer, show what was done first; the next ✕ leaves. */
  function end() {
    if (current && !paused && tally.answered > 0) {
      stopSpeech();
      setPaused(true);
    } else onClose();
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
    setPicked(null);
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
      end();
    } else if (paused) {
      return; // the summary is showing
    } else if ((e.key === ' ' || e.key === 'Enter') && !onButton && current) {
      e.preventDefault();
      if (flipped) rate('good');
      else flip(true);
    } else if (!flipped && quizArticle(current, data.prefs, lang.articles) && /^[1-3]$/.test(e.key)) {
      e.preventDefault();
      pick(ARTICLES[+e.key - 1]);
    } else if (flipped && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      rate(RATINGS[+e.key - 1]);
    } else if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key.toLowerCase() === 'p' && current) {
      e.preventDefault();
      speak(current.word.term, voice, data.prefs.slowSpeech);
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
  const quiz = quizArticle(current, data.prefs, lang.articles);

  return (
    <div className="review" role="dialog" aria-modal="true" aria-label={t('Review session')}>
      <div className="rv-top">
        <button className="icon-btn" onClick={end} aria-label={t('End session')}><Icon name="x" /></button>
        <div className="rv-counts" aria-label={t('Cards left')}>
          <span className={`rc${kind === 'new' ? ' is-cur' : ''}`} title={t('New')}><i className="dot k-new" />{counts.fresh}</span>
          <span className={`rc${kind === 'learn' ? ' is-cur' : ''}`} title={t('Learning')}><i className="dot k-learn" />{counts.learning}</span>
          <span className={`rc${kind === 'due' ? ' is-cur' : ''}`} title={t('To review')}><i className="dot k-due" />{counts.review}</span>
        </div>
        <button className="icon-btn" onClick={undo} aria-label={t('Undo last answer')} disabled={!undoStack.length}><Icon name="undo" /></button>
      </div>
      <div className="rv-bar"><i style={{ width: `${progress}%` }} /></div>

      {current && !paused ? (
        <>
          <div className="rv-stage">
            <Flashcard key={deal} item={current} quiz={quiz} picked={picked} flipped={flipped} onFlip={() => flip()} onSwipe={rate} />
          </div>
          <div className="rv-actions">
            {flipped ? (
              <RatingButtons item={current} now={now} onRate={rate} />
            ) : quiz ? (
              <>
                <div className="articles" role="group" aria-label={t('Which article?')}>
                  {ARTICLES.map((a, i) => (
                    <button key={a} className={`art-btn ab-${a}`} onClick={() => pick(a)} aria-keyshortcuts={String(i + 1)} lang="de">{a}</button>
                  ))}
                </div>
                <p className="rv-hint">
                  <span className="hint-touch">{t('der, die or das? Or tap the card to see the answer')}</span>
                  <span className="hint-keys">{t('Keys: 1 der · 2 die · 3 das · Space shows the answer')}</span>
                </p>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-xl" onClick={() => flip(true)}>{t('Show answer')}</button>
                <p className="rv-hint">
                  <span className="hint-touch">{t('Tap the card to turn it over')}</span>
                  <span className="hint-keys">{t('Space shows the answer · P plays it · Esc ends')}</span>
                </p>
              </>
            )}
          </div>
        </>
      ) : (
        <DoneScreen answered={tally.answered} again={tally.again} startedAt={startedAt} now={now} onClose={onClose} onMore={showNext}
          left={paused && current ? left : 0} onContinue={() => setPaused(false)} />
      )}
    </div>
  );
}

function RatingButtons({ item, now, onRate }: { item: QueueItem; now: number; onRate: (r: Rating) => void }) {
  const { prefs } = useStore();
  const { t, span } = useT();
  const pv = preview(item.s, now, srsConfig(prefs), item.key);
  return (
    <>
      <div className="ratings" role="group" aria-label={t('How well did you remember it?')}>
        {RATINGS.map((r, i) => (
          <button key={r} className={`rate r-${r}`} onClick={() => onRate(r)} aria-keyshortcuts={String(i + 1)}>
            <span className="rate-ivl">{span(pv[r])}</span>
            <span className="rate-label">{t(RATING_LABEL[r])}</span>
          </button>
        ))}
      </div>
      <p className="rv-hint">
        <span className="hint-touch">{t('Swipe the card left for Again, right for Good')}</span>
        <span className="hint-keys">{t('Keys: 1 Again · 2 Hard · 3 Good · 4 Easy · Z undo')}</span>
      </p>
    </>
  );
}

/**
 * The index card. Tap = flip. On the answer side, a horizontal swipe rates it:
 * left = Again, right = Good. touch-action: pan-y keeps vertical scrolling native.
 */
function Flashcard({ item, quiz, picked, flipped, onFlip, onSwipe }: {
  item: QueueItem;
  quiz: Article | ''; // the hidden article, when the der/die/das quiz is on
  picked: Article | null;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (r: Rating) => void;
}) {
  const { t } = useT();
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
      stamp.textContent = t(RATING_LABEL[r]);
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
      aria-label={t('Flashcard. Tap to turn it over.')}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
    >
      <div className="flip-inner">
        <article className="face front" aria-hidden={flipped}>
          <FrontFace item={item} quiz={quiz} />
        </article>
        <article className="face back" aria-hidden={!flipped}>
          <BackFace item={item} quiz={quiz} picked={picked} />
        </article>
      </div>
      <div className="stamp" ref={stampRef} aria-hidden="true" />
    </div>
  );
}

function FaceHead({ item, showGender }: { item: QueueItem; showGender: boolean }) {
  const { t } = useT();
  const w = item.word;
  const g = genderOf(w.term, useCourseLang().articles);
  const pos = t(POS_LABEL[w.pos] || '').toLowerCase();
  const isNew = !item.s || item.s.type === 'new';
  return (
    <div className="face-head">
      {showGender && g ? (
        <span className={`gchip g-${g}`}>{g}{pos ? ` · ${pos}` : ''}</span>
      ) : pos ? (
        <span className="gchip">{pos}</span>
      ) : null}
      {isNew && <span className="new-flag">{t('New')}</span>}
      <span className="face-deck">{w.deck}{item.dir === 'r' ? ` · ${t('production')}` : ''}</span>
    </div>
  );
}

function FrontFace({ item, quiz }: { item: QueueItem; quiz: Article | '' }) {
  const { t } = useT();
  const lang = useCourseLang();
  const w = item.word;
  if (item.dir === 'r') {
    // Production card: no gender hint on the question side.
    return (
      <>
        <FaceHead item={item} showGender={false} />
        <div className="face-main">
          <p className="prompt">{t(lang.text.prompt)}</p>
          <p className="meaning-xl">{w.meaning}</p>
        </div>
        <p className="face-foot">{t('Say it out loud, then tap to check')}</p>
      </>
    );
  }
  if (quiz) {
    // Article quiz: the article is hidden (no gender chip either) until the learner picks one.
    const { rest } = splitTerm(w.term);
    return (
      <>
        <FaceHead item={item} showGender={false} />
        <div className="face-main">
          <p className={`term-xl ${termSizeClass(w.term)}`} lang={lang.code}><span className="art-blank" aria-label={t('which article?')}>___</span> {rest}</p>
          <SpeakButton text={rest} />
        </div>
        <p className="face-foot">{t('der, die or das?')}</p>
      </>
    );
  }
  return (
    <>
      <FaceHead item={item} showGender />
      <div className="face-main">
        <p className={`term-xl ${termSizeClass(w.term, lang.articles)}`} lang={lang.code}><Term term={w.term} /></p>
        <SpeakButton text={w.term} />
      </div>
      <p className="face-foot">{t('Tap to reveal')}</p>
    </>
  );
}

function BackFace({ item, quiz, picked }: { item: QueueItem; quiz: Article | ''; picked: Article | null }) {
  const { cards } = useStore();
  const { t } = useT();
  const lang = useCourseLang();
  const w = item.word;
  const leech = lapsesOf(cards.get(w.id)) >= LEECH_AT;
  return (
    <>
      <FaceHead item={item} showGender />
      <div className="back-body">
        {quiz && picked && (
          <p className={`quiz-result ${picked === quiz ? 'is-right' : 'is-wrong'}`} role="status">
            <Icon name={picked === quiz ? 'check' : 'x'} />
            {picked === quiz
              ? <span><b lang={lang.code}>{lang.correct}</b> {t('It’s {art}.', { art: quiz })}</span>
              : <span>{t('Not {picked}: it’s {term}. Rate it Hard or Again.', { picked, term: w.term })}</span>}
          </p>
        )}
        <div className="back-term">
          <p className="term-lg" lang={lang.code}><Term term={w.term} /></p>
          <SpeakButton text={w.term} />
        </div>
        {w.pronunciation && <p className="ipa">{w.pronunciation}</p>}
        <p className="meaning-lg">{w.meaning}</p>
        {w.forms && (
          <div className="forms">
            <span className="lbl">{t('Forms')}</span>
            <span lang={lang.code}>{w.forms}</span>
          </div>
        )}
        {w.example && (
          <figure className="example">
            <blockquote lang={lang.code}>
              {highlightParts(w.example, w.term, lang.articles).map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>))}{' '}
              <SpeakButton text={w.example} small />
            </blockquote>
            {w.exampleTr && <figcaption>{w.exampleTr}</figcaption>}
          </figure>
        )}
        {w.mnemonic ? (
          <div className="hook">
            <p className="lbl">{t('Memory hook')}</p>
            <p>{w.mnemonic}</p>
          </div>
        ) : leech ? (
          <div className="hook is-missing">{t('You keep forgetting this word. Add a memory hook in Words.')}</div>
        ) : null}
        {w.notes && <p className="note">{w.notes}</p>}
      </div>
    </>
  );
}

function DoneScreen({ answered, again, startedAt, now, onClose, onMore, left, onContinue }: {
  answered: number;
  again: number;
  startedAt: number;
  now: number;
  onClose: () => void;
  onMore: () => void;
  left: number; // cards still waiting when the session was ended early (0: all done)
  onContinue: () => void;
}) {
  const data = useStore();
  const { t, tn, span } = useT();
  const lang = useCourseLang();
  const at = Math.max(now, startedAt);
  const q = buildQueue(data, at);
  const nx = nextDueSummary(data, at);
  const today = dayIndex(at);
  const mins = Math.max(1, Math.round((at - startedAt) / MIN));
  const pct = answered ? Math.round((100 * (answered - again)) / answered) : 0;
  let next = '';
  if (left) next = tn(left, '{n} card is still waiting for today.', '{n} cards are still waiting for today.');
  else if (nx.soonest) {
    next = tn(q.learning.length, '{n} card is still in learning and comes back in {time}.', '{n} cards are still in learning and come back in {time}.', {
      time: span(nx.soonest - at),
    });
  } else if (nx.day === today + 1) next = tn(nx.count, 'Next reviews tomorrow: {n} card.', 'Next reviews tomorrow: {n} cards.');
  else if (nx.day != null) next = tn(nx.count, 'Next reviews on {day}: {n} card.', 'Next reviews on {day}: {n} cards.', { day: dayLong(nx.day, lang.locale) });
  const canLearnMore = q.fresh.length > 0 && q.newLeft === 0;
  const saveNudge = data.guest && answered > 0; // the moment of value: ask guests to keep their progress
  const goal = data.prefs.dailyGoal;
  const doneToday = answersToday(data.cards.values(), at);
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
          <p className="eyebrow" lang={lang.code}>{left ? lang.pause : lang.done}</p>
          <h2>{t(left ? 'Good work so far' : answered ? 'Done for now' : 'Nothing to study right now')}</h2>
          {answered > 0 && (
            <div className="done-stats">
              <div><b>{answered}</b><span>{t(answered === 1 ? 'answer' : 'answers')}</span></div>
              <div><b>{pct}%</b><span>{t('remembered')}</span></div>
              <div><b>{mins}</b><span>{t(mins === 1 ? 'minute' : 'minutes')}</span></div>
            </div>
          )}
          {goal > 0 && answered > 0 && (
            <p className={`goal-line${doneToday >= goal ? ' is-reached' : ''}`}>
              <Icon name={doneToday >= goal ? 'check' : 'flame'} />
              {doneToday >= goal ? t('Daily goal reached: {n} answers today.', { n: doneToday }) : t('{n} more answers to reach today’s goal.', { n: goal - doneToday })}
            </p>
          )}
          {next && <p>{next}</p>}
          {left > 0 && <button className="btn" onClick={onContinue}>{t('Keep studying')}</button>}
          {!left && canLearnMore && <button className="btn" onClick={learnMore}>{t('Learn 10 more new words')}</button>}
          {saveNudge && (
            <div className="save-card">
              <p>
                <b>{t('Keep what you learned.')}</b>{' '}
                {tn(data.cards.size, 'Your {n} word is only saved on this device. A free profile keeps it and starts your streak.',
                  'Your {n} words are only saved on this device. A free profile keeps them and starts your streak.')}
              </p>
              <Link className="btn btn-primary" href="/signup">{t('Create a free profile')}</Link>
            </div>
          )}
        </section>
      </div>
      <div className="rv-actions">
        <button className={`btn btn-xl${saveNudge ? '' : ' btn-primary'}`} onClick={onClose} ref={doneRef}>{t('Back to the box')}</button>
        <p className="rv-hint" />
      </div>
    </>
  );
}
