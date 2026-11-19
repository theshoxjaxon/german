/**
 * Sharing a result from the browser: ask the server for the public link, then hand it to the
 * phone's share sheet (Telegram, WhatsApp, …), or copy it where there is no share sheet.
 */
const APP_NAME = 'Karteikasten'; // a name, never translated

export type ShareBody = { kind: 'test'; attemptId: string } | { kind: 'streak' };

export async function createShare(body: ShareBody): Promise<string> {
  const res = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !data?.url) throw new Error(data?.error || 'Could not reach the server. Check your internet connection, then try again.');
  return data.url;
}

/**
 * 'blocked': the browser refused (a share sheet needs a fresh tap, and the link took a moment
 * to make): show the link and let them tap again.
 */
export async function sendShare(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'blocked'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: APP_NAME, text, url });
      return 'shared';
    } catch (e) {
      const name = (e as Error).name;
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'blocked';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'blocked';
  }
}
