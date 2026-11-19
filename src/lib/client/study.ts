/** The study-together API, for the browser. */
import type { StudyClub, StudyMessage, StudyState } from '../study/types';

async function call<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error || 'Could not reach the server. Check your internet connection, then try again.');
  return data;
}

const group = (id: string) => `/api/study/groups/${encodeURIComponent(id)}`;

export const fetchStudy = () => call<StudyState>('/api/study');
export const saveSlots = (slots: number[]) => call<StudyState>('/api/study/signup', 'PUT', { slots });
export const withdraw = () => call<StudyState>('/api/study/signup', 'DELETE');
export const fetchMessages = (id: string, after: number) =>
  call<{ messages: StudyMessage[] }>(`${group(id)}/messages?after=${after}`).then((r) => r.messages);
export const postMessage = (id: string, body: string) => call<{ message: StudyMessage }>(`${group(id)}/messages`, 'POST', { body }).then((r) => r.message);
export const leave = (id: string) => call<{ ok: true }>(`${group(id)}/leave`, 'POST', {});
export const block = (id: string, member: string) => call<{ ok: true }>(`${group(id)}/block`, 'POST', { member });
export const report = (id: string, member: string, reason: string) => call<{ ok: true }>(`${group(id)}/report`, 'POST', { member, reason });
export const rsvp = (club: string, going: boolean) =>
  call<{ clubs: StudyClub[] }>(`/api/study/clubs/${encodeURIComponent(club)}/rsvp`, 'POST', { going }).then((r) => r.clubs);
