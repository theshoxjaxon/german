'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tick, useNow } from '@/lib/client/hooks';
import { speak } from '@/lib/client/speech';
import { store, useStore, type Snapshot } from '@/lib/client/store';
import { LANGS, type Lang } from '@/lib/langs';
import { LANGS as COURSE_LANGS } from '@/lib/courses';
import { buildQueue, srsConfig, type QueueItem } from '@/lib/queue';
import { answer, preview } from '@/lib/srs';
import { DAY, dayIndex, fmtSpan, HOUR, MIN, ROLLOVER_HOUR } from '@/lib/time';
import { CHEERS, type CardDoc, type CheerKind, type Rating, type StudyData } from '@/lib/types';

const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();

/* ---------- derived numbers (no extra backend: everything comes from your cards) ---------- */
function xpOf(cards: Snapshot['cards']) {
  let n = 0;
  cards.forEach((c) => (n += (c.f?.log.length || 0) + (c.r?.log.length || 0)));
  return n * 10; // 10 XP per answer (each card keeps its last 30)
}
const levelOf = (xp: number) => {
  const lv = Math.floor(Math.sqrt(xp / 100)) + 1;
  const base = (lv - 1) ** 2 * 100, next = lv ** 2 * 100;
  return { lv, pct: ((xp - base) / (next - base)) * 100, label: `${xp - base} / ${next - base} XP` };
};
function streakOf(cards: Snapshot['cards'], now: number) {
  const days = new Set<number>();
  cards.forEach((c) => [c.f, c.r].forEach((s) => s?.log.forEach((e) => days.add(dayIndex(e.t)))));
  let d = dayIndex(now), n = 0;
  if (!days.has(d)) d--; // not studied yet today: yesterday still counts
  while (days.has(d)) { n++; d--; }
  return n;
}
function untilRollover(now: number) {
  const off = new Date(now).getTimezoneOffset() * MIN;
  const left = DAY - ((((now - off - ROLLOVER_HOUR * HOUR) % DAY) + DAY) % DAY);
  const h = Math.floor(left / HOUR), m = Math.floor((left % HOUR) / MIN);
  return { long: `${h}h ${String(m).padStart(2, '0')}m`, short: `${h}h` };
}

type Sheet = { kind: 'ping'; id: string; name: string } | { kind: 'me' } | null;
interface StageSpec { heading: string; items: QueueItem[]; lang: Lang; speech: string }

const studyData = (snap: Snapshot): StudyData => ({ words: snap.words, cards: snap.cards, prefs: { ...snap.prefs, studyDeck: 'all' } });
const SAMPLE: Record<string, string> = { de: 'der Hund', en: 'hello' };

function useToast() {
  const [msg, setMsg] = useState('');
  const toast = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((cur) => (cur === m ? '' : cur)), 2600);
  }, []);
  return [msg, toast] as const;
}

/* ---------- home (/): pick a language ---------- */
interface CourseRow { id: string; name: string; targetLang: string; words: number }
export function WordfieldHome() {
  const now = useNow();
  const [data, setData] = useState<{ courses: CourseRow[]; current: string | null; signedIn: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [toastMsg, toast] = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/courses', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setData, () => {});
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const langs = LANGS.filter((l) => !q || [l.name, l.native, l.code].some((x) => x.toLowerCase().includes(q)));
  const cd = now ? untilRollover(now) : { long: '', short: '' };
  const courseOf = (l: Lang) => data?.courses.find((c) => c.targetLang === l.targetLang)?.id ?? l.course;
  const wordsOf = (l: Lang) => (data?.courses ?? []).filter((c) => c.targetLang === l.targetLang).reduce((n, c) => n + c.words, 0);
  const total = LANGS.reduce((n, l) => n + (l.course ? wordsOf(l) : 0), 0);
  const open = LANGS.filter((l) => l.course);

  return (
    <div className="wf">
      <div className="in">
        <nav className="nav">
          <a href="#" className="brand"><i />Wordfield</a>
          {data?.signedIn
            ? <>{data.current && <Link href={`/${data.current}`} className="btn-lime">Continue</Link>}<Link href="/classic" className="btn-ghost">Words</Link></>
            : <><Link href="/login" className="btn-ghost">Sign in</Link><Link href="/signup" className="btn-lime">Get started</Link></>}
        </nav>
        <section className="hero">
          <span className="live"><span className="live-dot" />{total} words ready to learn</span>
          <h1>Pick a language. Start swiping in under a second.</h1>
          <p className="lede">Daily 24-hour decks, flashcards that remember what you forget, and friend streaks. German and English are open today; more languages are on the way.</p>
          <label className="search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7A8396" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input ref={searchRef} type="search" aria-label="Search languages" placeholder="Search languages" value={query} onChange={(e) => setQuery(e.target.value)} />
            <span className="kbd">/</span>
          </label>
        </section>
        <section className="sec">
          <div className="sec-head"><h2>Languages</h2><span className="tiny">{langs.length} shown</span></div>
          <div className="grid">
            {langs.map((l) => {
              const inner = (
                <>
                  <div className="lang-top">
                    <span className="code">{l.code}</span>
                    {l.course ? <span className="pill pill-gold">24h{cd.short && ` · ${cd.short}`}</span> : <span className="pill pill-grey">Coming soon</span>}
                  </div>
                  <div><span className="lang-name">{l.name}</span><span className="lang-native">{l.native}</span></div>
                  {l.course && <span className="lang-live"><i />{wordsOf(l)} words</span>}
                </>
              );
              return l.course
                ? <Link key={l.id} href={`/${courseOf(l)}`} className="lang" aria-label={`Open ${l.name}`}>{inner}</Link>
                : <button key={l.id} className="lang off" onClick={() => toast(`${l.name} is coming soon.`)} aria-label={`${l.name}, coming soon`}>{inner}</button>;
            })}
          </div>
          {!langs.length && (
            <div className="empty"><b style={{ fontSize: 20 }}>Nothing matches “{query}”</b><span className="note">We add languages every month.</span></div>
          )}
        </section>
        <section className="sec" style={{ paddingBottom: 96 }}>
          <div className="sec-head"><h2>Today’s Snap-Decks</h2>{cd.long && <span className="mono" style={{ fontSize: 13, color: 'var(--gold)' }}>expire in {cd.long}</span>}</div>
          <div className="snaps">
            {open.map((l, i) => (
              <Link key={l.id} href={`/${courseOf(l)}`} className="snap" aria-label={`${l.name} snap-deck`}>
                <div className={`snap-art g${i}`}>{SAMPLE[l.id]}</div>
                <div className="snap-shade" />
                <span className="snap-tag">{l.code} · {wordsOf(l)} cards</span>
                <div className="snap-foot"><b>{data?.courses.find((c) => c.targetLang === l.targetLang)?.name ?? l.name}</b><span>{l.name}</span></div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}

/* ---------- a course page (/german, /english): dashboard + stage ---------- */
export function WordfieldCourse({ urlCourse }: { urlCourse: string }) {
  const snap = useStore();
  const now = useNow();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [stage, setStage] = useState<StageSpec | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toastMsg, toast] = useToast();

  useEffect(() => {
    store.setErrorHandler(toast);
    void store.load(urlCourse);
    const refresh = () => { if (!document.hidden) { tick(); void store.load(); } };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [toast, urlCourse]);
  const courseId = snap.course?.id;
  useEffect(() => { if (snap.me && courseId) void store.loadClass(); }, [snap.me, courseId]);
  useEffect(() => { if (snap.status === 'ready' && !snap.course) router.replace('/'); }, [snap.status, snap.course, router]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); setSheet(null); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const lang = LANGS.find((l) => l.targetLang === snap.course?.targetLang) ?? LANGS[0];
  const speech = COURSE_LANGS[snap.course?.targetLang ?? 'de'].voices[0][0];
  const pick = (l: Lang) => {
    if (!l.course) return toast(`${l.name} is coming soon.`);
    setMenu(false);
    if (l.targetLang !== snap.course?.targetLang) router.push(`/${snap.courses.find((c) => c.targetLang === l.targetLang)?.id ?? l.course}`);
  };
  const ready = snap.status === 'ready' && courseId === urlCourse;

  return (
    <div className="wf">
      <Dash snap={snap} now={now} lang={lang} ready={ready} menu={menu} setMenu={setMenu} pick={pick}
        goHome={() => router.push('/')} setStage={(s) => setStage({ ...s, speech })} setSheet={setSheet} />
      {stage && <Stage spec={stage} onClose={() => { setStage(null); tick(); }} setSheet={setSheet} />}
      {sheet && <SheetView sheet={sheet} snap={snap} close={() => setSheet(null)} toast={toast} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}

/* ---------- dashboard ---------- */
function Dash({ snap, now, lang, ready, menu, setMenu, pick, goHome, setStage, setSheet }: {
  snap: Snapshot; now: number; lang: Lang; ready: boolean; menu: boolean; setMenu: (b: boolean) => void;
  pick: (l: Lang) => void; goHome: () => void; setStage: (s: Omit<StageSpec, 'speech'>) => void; setSheet: (s: Sheet) => void;
}) {
  const t = now; // 0 until the browser clock starts
  const { me, guest, classData, cheers } = snap;
  const lvl = levelOf(xpOf(snap.cards));
  const streak = streakOf(snap.cards, t);
  const q = useMemo(() => buildQueue(studyData(snap), t), [snap, t]);
  const newItems = q.fresh.slice(0, Math.min(8, q.newLeft));
  const dueItems = [...q.learning.filter((x) => x.s!.due <= t), ...q.review.slice(0, q.reviewLeft)].slice(0, 30);
  const cd = now ? untilRollover(now).long : '';
  const friends = classData?.members.filter((m) => !m.isMe) ?? [];
  const league = [...(classData?.members ?? [])].sort((a, b) => b.answersWeek - a.answersWeek).slice(0, 6);
  const heroWord = newItems[0]?.word;
  const parts = [
    { name: 'learning', n: q.counts.learning, c: '#FFE45C' },
    { name: 'review', n: q.counts.review, c: '#7aa7ff' },
  ];

  return (
    <div className="in">
      <header className="top">
        <div className="top-in">
          <button className="round" onClick={goHome} aria-label="All languages">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button className="langbtn" onClick={() => setMenu(!menu)} aria-haspopup="listbox" aria-expanded={menu}>
              <span className="code">{lang.code}</span><b style={{ fontSize: 15, fontWeight: 600 }}>{lang.name}</b>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3ABBA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {menu && (
              <div className="menu" role="listbox">
                {LANGS.map((l) => (
                  <button key={l.id} role="option" aria-selected={l.id === lang.id} aria-disabled={!l.course} onClick={() => pick(l)}>
                    <span className="mono">{l.code}</span>{l.name}{!l.course && <span className="pill pill-grey" style={{ marginLeft: 'auto' }}>Soon</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="lvl">
            <b>LV {lvl.lv}</b>
            <div className="bar" aria-label="Level progress"><i style={{ width: `${lvl.pct}%` }} /></div>
            <span>{lvl.label}</span>
          </div>
          <span className="streak" title="Daily streak">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>{streak}
          </span>
          {me
            ? <button className="me" onClick={() => setSheet({ kind: 'me' })} aria-label="Your profile">{initial(me.displayName)}</button>
            : <Link href="/login" className="btn-lime" style={{ height: 40 }}>Sign in</Link>}
        </div>
      </header>

      {friends.length > 0 && (
        <div className="friends">
          {friends.map((f) => (
            <button key={f.id} className="friend" onClick={() => setSheet({ kind: 'ping', id: f.id, name: f.displayName })} aria-label={`Send ${f.displayName} a cheer`}>
              <span className={`ring${f.studiedToday ? '' : ' idle'}`}><span>{initial(f.displayName)}</span></span>
              <span className="nm">{f.displayName.split(' ')[0]}</span>
              <span className="st">🔥 {f.streak}</span>
            </button>
          ))}
        </div>
      )}

      <main className="main">
        {!ready && <div className="panel">{snap.status === 'error' ? 'Could not load your cards. Check your connection and refresh.' : 'Loading your cards…'}</div>}
        {ready && (
          <div className="row2">
            <div className="hero-card">
              <div className="snap-art g0">{heroWord?.term ?? 'All caught up'}</div>
              <div className="snap-shade" />
              <div className="hero-badge"><span>24H SNAP-DECK</span><span className="t">{cd}</span></div>
              <div className="info">
                <b>{heroWord ? heroWord.deck || lang.name : 'Nothing new today'}</b>
                <span>{newItems.length ? `${newItems.length} new ${lang.name} words · ${snap.course?.words ?? snap.words.size} in the course` : 'Come back after the day rolls over, or review what is due.'}</span>
                <button className="btn-lime" disabled={!newItems.length} onClick={() => setStage({ heading: 'SNAP-DECK', items: newItems, lang })}>{newItems.length ? 'Start snap-deck' : 'Done for today'}</button>
              </div>
            </div>
            <div className="panel">
              <span className="label">Due reviews</span>
              <span className="due-n">{dueItems.length}</span>
              <div className="segs" aria-hidden="true">{parts.flatMap((p) => Array.from({ length: Math.min(p.n, 12) }, (_, i) => <i key={p.name + i} style={{ background: p.c }} />))}</div>
              <div className="legend">{parts.map((p) => <span key={p.name}><i style={{ background: p.c }} />{p.name} {p.n}</span>)}</div>
              <button className="btn-lime" style={{ alignSelf: 'flex-start' }} disabled={!dueItems.length} onClick={() => setStage({ heading: 'DUE REVIEWS', items: dueItems, lang })}>
                {dueItems.length ? `Review ${dueItems.length} cards` : 'Nothing due'}
              </button>
            </div>
          </div>
        )}

        <div className="row2b">
          <section className="panel">
            <div className="sec-head"><h2>Card pings</h2><span className="note">Cheers from classmates</span></div>
            {guest && <p className="note">Create a free profile to join your class: friends, cheers and the league.</p>}
            {!guest && !cheers.length && <p className="note">No new cheers. Tap a friend above to send one.</p>}
            <div className="list">
              {cheers.slice(0, 4).map((c) => (
                <div key={c.id} className="li">
                  <span className="av">{initial(c.from.displayName)}</span>
                  <span className="tx"><span>{c.from.displayName} says <b>{CHEERS[c.kind]}</b></span><small>+ keep your streak alive</small></span>
                </div>
              ))}
            </div>
            {cheers.length > 0 && <button className="mini" style={{ alignSelf: 'flex-start' }} onClick={() => store.dismissCheers()}>Thanks!</button>}
            {guest && <Link href="/signup" className="btn-lime" style={{ alignSelf: 'flex-start' }}>Get started</Link>}
          </section>
          <section className="panel">
            <div className="sec-head"><h2>Class league</h2><span className="tiny">this week</span></div>
            {!league.length && <p className="note">{guest ? 'Sign in to see how your class is doing.' : 'Loading your class…'}</p>}
            <div className="list">
              {league.map((m, i) => (
                <div key={m.id} className={`li${m.isMe ? ' me-row' : ''}`}>
                  <span className="rk">{i + 1}</span><span className="av">{initial(m.displayName)}</span>
                  <span className="tx">{m.displayName}</span><span className="xp">{m.answersWeek * 10} XP</span>
                </div>
              ))}
            </div>
            <span className="note">Top 3 are the class stars of the week.</span>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ---------- stage: swipe flashcards ---------- */
function Stage({ spec, onClose, setSheet }: { spec: StageSpec; onClose: () => void; setSheet: (s: Sheet) => void }) {
  const [queue, setQueue] = useState<QueueItem[]>(spec.items);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(0);
  const [combo, setCombo] = useState(0);
  const [tally, setTally] = useState({ n: 0, again: 0, best: 0, xp: 0 });
  const [pop, setPop] = useState(0);
  const start = useRef(0);
  const moved = useRef(false);
  const requeued = useRef(new Set<string>());

  const clock = useNow();
  const item = queue[i];
  const done = !item;
  const front = item ? (item.dir === 'f' ? item.word.term : item.word.meaning) : '';
  const back = item ? (item.dir === 'f' ? item.word.meaning : item.word.term) : '';

  const rate = useCallback((rating: Rating) => {
    if (!item || leaving) return;
    const t = Date.now();
    const snap = store.getSnapshot();
    const prevDoc = snap.cards.get(item.word.id) ?? null;
    const next = answer(prevDoc?.[item.dir] ?? null, rating, t, srsConfig(snap.prefs), item.key);
    const doc: CardDoc = { f: prevDoc?.f ?? null, r: prevDoc?.r ?? null, suspended: !!prevDoc?.suspended, updatedAt: t };
    doc[item.dir] = next;
    void store.saveCard(item.word.id, doc);
    const good = rating !== 'again';
    const c = good ? combo + 1 : 0;
    setCombo(c);
    setTally((s) => ({ n: s.n + 1, again: s.again + (good ? 0 : 1), best: Math.max(s.best, c), xp: s.xp + 10 }));
    setPop((p) => p + 1);
    if (!good && !requeued.current.has(item.key)) { requeued.current.add(item.key); setQueue((q) => [...q, item]); }
    setLeaving(good ? 1 : -1);
    setTimeout(() => { setLeaving(0); setDx(0); setFlipped(false); setI((n) => n + 1); }, 220);
  }, [item, leaving, combo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') rate('again');
      else if (e.key === 'ArrowRight') rate('good');
      else if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rate, onClose]);

  const pv = item ? preview(item.s, clock, srsConfig(store.getSnapshot().prefs), item.key) : null;
  const speakIt = () => item && speak(item.word.term, spec.speech);
  const x = leaving ? leaving * 700 : dx;

  return (
    <div className="stage" role="dialog" aria-modal="true" aria-label="Flashcard stage">
      {!done ? (
        <>
          <div className="stage-top">
            <button className="round" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
            <div className="prog" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={i}>
              {queue.map((_, k) => <i key={k} className={k < i ? 'ok' : k === i ? 'cur' : ''} />)}
            </div>
            <span className="combo">COMBO {combo}</span>
            {pop > 0 && <span key={pop} className="pop">+10 XP</span>}
          </div>
          <div className="stage-title"><span>{spec.heading} · {spec.lang.name}</span><span>{i + 1} / {queue.length}</span></div>
          <div className="deck">
            <div className={`scard${dragging ? ' drag' : ''}`} style={{ transform: `translateX(${x}px) rotate(${x / 18}deg)`, opacity: leaving ? 0 : 1 }}
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); start.current = e.clientX; moved.current = false; setDragging(true); }}
              onPointerMove={(e) => { if (!dragging) return; const d = e.clientX - start.current; if (Math.abs(d) > 6) moved.current = true; setDx(d); }}
              onPointerUp={() => {
                setDragging(false);
                if (dx > 100) rate('good'); else if (dx < -100) rate('again');
                else { setDx(0); if (!moved.current) setFlipped((f) => !f); }
              }}
              onPointerCancel={() => { setDragging(false); setDx(0); }}>
              <span className="stamp r" style={{ opacity: Math.min(1, Math.max(0, dx / 100)) }}>GOT IT</span>
              <span className="stamp l" style={{ opacity: Math.min(1, Math.max(0, -dx / 100)) }}>AGAIN</span>
              <div className={`flip${flipped ? ' back' : ''}`}>
                <div className="face front">
                  <div className="face-top">
                    <span>{item.word.pos.toUpperCase()} · {item.word.deck}</span>
                    <button className="speak" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); speakIt(); }} aria-label="Play pronunciation">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" /><path d="M15.5 9a4 4 0 0 1 0 6" /></svg>
                    </button>
                  </div>
                  <div>
                    <div className="big" dir="auto">{front}</div>
                    {item.dir === 'f' && item.word.pronunciation && <div className="cap" style={{ marginTop: 8 }}>{item.word.pronunciation}</div>}
                  </div>
                  <span className="cap">TAP TO FLIP · SWIPE TO RATE</span>
                </div>
                <div className="face rear">
                  <span className="sec-l">{item.dir === 'f' ? 'TRANSLATION' : 'WORD'}</span>
                  <div className="tr" dir="auto">{back}</div>
                  {item.word.example && <div className="box"><span dir="auto">{item.word.example}</span><small>{item.word.exampleTr}</small></div>}
                  {(item.word.forms || item.word.mnemonic) && (
                    <div className="box"><span className="sec-l">GRAMMAR</span>{item.word.forms && <span>{item.word.forms}</span>}{item.word.mnemonic && <small>{item.word.mnemonic}</small>}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span className="cap mono" style={{ fontSize: 12, color: 'var(--ink2)' }}>← {pv && fmtSpan(pv.again)} &nbsp; → {pv && fmtSpan(pv.good)}</span>
                    <button className="mini" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setSheet({ kind: 'ping', id: '', name: '' }); }}>Cheer a friend</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="actions">
            <button className="act no" onClick={() => rate('again')} aria-label="Review again"><span className="c"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></span>Again</button>
            <button className="flipbtn" onClick={() => setFlipped((f) => !f)} aria-label="Flip card">FLIP · SPACE</button>
            <button className="act yes" onClick={() => rate('good')} aria-label="Got it"><span className="c"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>Got it</button>
          </div>
          <span className="hint">← again · space flip · got it →</span>
        </>
      ) : (
        <div className="done">
          <span className="flame" aria-hidden="true">🔥</span>
          <div><h2 style={{ fontSize: 32 }}>{tally.n ? 'Deck cleared' : 'Nothing to do'}</h2><span className="note">{tally.n} answers · +{tally.xp} XP</span></div>
          <div className="sum">
            <Stat label="ANSWERED" value={tally.n} /><Stat label="AGAIN" value={tally.again} /><Stat label="BEST COMBO" value={tally.best} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-lime" onClick={onClose}>Back to dashboard</button>
            <button className="btn-ghost" style={{ border: '1px solid var(--line)' }} onClick={() => setSheet({ kind: 'ping', id: '', name: '' })}>Cheer a friend</button>
          </div>
        </div>
      )}
    </div>
  );
}
const Stat = ({ label, value }: { label: string; value: ReactNode }) => <div><b>{value}</b><span>{label}</span></div>;

/* ---------- bottom sheets: cheer a friend / profile ---------- */
function SheetView({ sheet, snap, close, toast }: { sheet: NonNullable<Sheet>; snap: Snapshot; close: () => void; toast: (m: string) => void }) {
  const friends = snap.classData?.members.filter((m) => !m.isMe) ?? [];
  async function send(id: string, name: string, kind: CheerKind) {
    close();
    if (await store.sendCheer(id, kind)) toast(`Sent “${CHEERS[kind]}” to ${name.split(' ')[0]}`);
  }
  return (
    <div className="sheet-bg" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {sheet.kind === 'me' && snap.me && (
          <>
            <h2>{snap.me.displayName}</h2>
            {snap.me.email && <span className="note">{snap.me.email}</span>}
            <Link href="/classic" className="btn-lime" style={{ justifyContent: 'center' }}>Words, AI helper &amp; progress</Link>
            {(snap.me.role === 'admin' || snap.me.teacher) && <Link href="/admin" className="btn-ghost" style={{ border: '1px solid var(--line)', justifyContent: 'center' }}>Teacher dashboard</Link>}
            <form action="/api/logout" method="post"><button className="btn-ghost" style={{ width: '100%', border: '1px solid var(--line)', justifyContent: 'center' }}>Log out</button></form>
          </>
        )}
        {sheet.kind === 'ping' && (
          <>
            <h2>{sheet.id ? `Cheer ${sheet.name.split(' ')[0]}` : 'Cheer a friend'}</h2>
            <span className="note">One cheer per classmate per day. It keeps their streak going.</span>
            {snap.guest && <span className="note">Create a free profile to cheer your classmates.</span>}
            <div className="list">
              {(sheet.id ? friends.filter((f) => f.id === sheet.id) : friends).map((f) => (
                <div key={f.id} className="li">
                  <span className="av">{initial(f.displayName)}</span>
                  <span className="tx">{f.displayName}<small>{f.streak} day streak</small></span>
                  {f.cheeredToday ? <span className="note">Sent today</span> : (
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(Object.keys(CHEERS) as CheerKind[]).map((k) => <button key={k} className="mini" onClick={() => send(f.id, f.displayName, k)}>{CHEERS[k]}</button>)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
