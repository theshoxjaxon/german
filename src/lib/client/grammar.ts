/** The grammar trainer from the browser's side: the API calls. */
import type { PerfektCheck, Verb } from '../grammar/perfekt';
import type { Given, Outcome, Progress, Task } from '../grammar/session';

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined
    ? { cache: 'no-store' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error || 'Could not reach the server. Check your internet connection, then try again.');
  return data;
}

export interface PerfektData {
  verbs: Verb[];
  progress: Progress;
  tasks: Task[];
  ai: boolean;
}
export type SessionResult = { progress: Progress; outcome: Omit<Outcome, 'state'>; tasks: Task[] };

export const fetchPerfekt = () => call<PerfektData>('/api/grammar/perfekt');
export const saveSession = (answers: { task: Task; given: Given }[]) => call<SessionResult>('/api/grammar/perfekt', { answers });
export const checkWriting = (text: string, lang: string) => call<{ check: PerfektCheck }>('/api/grammar/perfekt/check', { text, lang }).then((r) => r.check);
