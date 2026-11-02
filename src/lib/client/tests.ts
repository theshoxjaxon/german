/**
 * The mock tests from the browser's side: the API calls, and a draft of your answers kept on
 * this device while you take a test, so a reload or a closed tab loses nothing.
 */
import type { Answers, AttemptDetail, AttemptSummary, PublicTest, TestInfo } from '../tests/types';

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined
    ? { cache: 'no-store' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error || 'Could not reach the server. Check your internet connection, then try again.');
  return data;
}

export const fetchTests = () => call<{ tests: TestInfo[]; attempts: AttemptSummary[]; ai: boolean }>('/api/tests');
export const fetchTest = (id: string) => call<{ test: PublicTest }>(`/api/tests/${encodeURIComponent(id)}`).then((r) => r.test);
export const fetchAttempt = (id: string) => call<{ attempt: AttemptDetail }>(`/api/tests/attempts/${encodeURIComponent(id)}`).then((r) => r.attempt);
export const submitTest = (id: string, answers: Answers, startedAt: number) =>
  call<{ attempt: AttemptDetail; ai: boolean }>(`/api/tests/${encodeURIComponent(id)}/submit`, { answers, startedAt });
/** Ask the AI to score the writing and speaking (feedback in `lang`). */
export const requestFeedback = (id: string, lang: string) =>
  call<{ attempt: AttemptDetail }>(`/api/tests/attempts/${encodeURIComponent(id)}/feedback`, { lang }).then((r) => r.attempt);

/* ---------- the draft of a test in progress ---------- */

export interface Draft {
  answers: Answers;
  startedAt: number;
  section: number; // the section on screen
  plays: Record<string, number>; // how often each recording was played
}
const key = (testId: string) => `kk.test.${testId}`;

export function readDraft(testId: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key(testId)) ?? 'null') as Partial<Draft> | null;
    if (!d || typeof d.startedAt !== 'number' || !d.answers || typeof d.answers !== 'object') return null;
    return { answers: d.answers, startedAt: d.startedAt, section: Number(d.section) || 0, plays: d.plays ?? {} };
  } catch {
    return null;
  }
}
export function saveDraft(testId: string, draft: Draft) {
  try {
    localStorage.setItem(key(testId), JSON.stringify(draft));
  } catch {
    /* storage blocked: the test still works, without the safety net */
  }
}
export function clearDraft(testId: string) {
  try {
    localStorage.removeItem(key(testId));
  } catch {
    /* ignore */
  }
}
