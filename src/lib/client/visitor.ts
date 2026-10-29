/**
 * Anonymous visit counting for the funnel on /admin/analytics (Visit → Try → Join).
 *
 * The browser makes up a random id and keeps it in localStorage. Only that id, the course and
 * "answered a card" are sent: no name, no cookies, nothing about the person. Signed-in people
 * aren't counted here; their study is already in their profile. If storage is blocked, nothing
 * is sent.
 */
import { VISITOR_RE } from '../text';

const KEY = 'kk.visitor';
interface Saved {
  id: string;
  day?: string; // last day a visit was sent (this browser's calendar), so we send at most one a day
  tried?: boolean;
}

function read(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return v && typeof v.id === 'string' && VISITOR_RE.test(v.id) ? v : null;
  } catch {
    return null;
  }
}

function save(v: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: then read() returns null and nothing is counted */
  }
}

/** This browser's anonymous id, made up on first use. Null when storage is blocked. */
export function visitorId(): string | null {
  const saved = read();
  if (saved) return saved.id;
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return null;
  save({ id: crypto.randomUUID() });
  return read()?.id ?? null;
}

function send(id: string, tried: boolean, course: string | null) {
  fetch('/api/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, tried, course }),
    keepalive: true,
  }).catch(() => {}); // counting must never get in the way of studying
}

const localDay = () => new Date().toDateString();

/** Opened a course without a profile (null: the course this browser picked, if any). Sent once a day. */
export function noteVisit(course: string | null = null) {
  const id = visitorId();
  const saved = id && read();
  if (!id || !saved || saved.day === localDay()) return;
  save({ ...saved, day: localDay() });
  send(id, false, course);
}

/** Answered a first card as a guest. Sent once per browser. */
export function noteTry(course: string) {
  const id = visitorId();
  const saved = id && read();
  if (!id || !saved || saved.tried) return;
  save({ ...saved, tried: true, day: localDay() });
  send(id, true, course);
}
