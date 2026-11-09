/**
 * The Telegram reminder from the browser's side: its state, the connect flow (a one-time t.me
 * link, then waiting for Start to be pressed in Telegram) and the switches.
 */
import { useEffect, useState } from 'react';
import { usePoll } from './hooks';
import { goal } from './metrica';

export interface TelegramState {
  available: boolean; // the bot is set up on this server
  linked: boolean;
  reminders: boolean;
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch('/api/telegram', {
    method,
    cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error || 'Could not reach the server. Check your internet connection, then try again.');
  return data;
}

/** How long to keep checking for Start after the link was made (a code lasts 15 minutes). */
const WAIT_MS = 3 * 60_000;

/** Everything the Settings section and the home card need. `enabled`: only for signed-in people. */
export function useTelegram(enabled: boolean, onConnected?: () => void) {
  const [state, setState] = useState<TelegramState | null>(null);
  const [link, setLink] = useState<{ url: string; until: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    call<TelegramState>('GET').then((s) => live && setState(s), () => live && setState(null));
    return () => {
      live = false;
    };
  }, [enabled]);

  // After the link is opened: check every few seconds until Telegram confirms (or we give up)
  usePoll(async () => {
    if (!link) return;
    if (Date.now() > link.until) return setLink(null);
    const s = await call<TelegramState>('GET');
    setState(s);
    if (s.linked) {
      setLink(null);
      goal('telegram_connect');
      onConnected?.();
    }
  }, 3000, !!link && !state?.linked);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return {
    state,
    link: link?.url ?? null,
    busy,
    error,
    connect: () => run(async () => setLink({ url: (await call<{ url: string }>('POST', { action: 'link' })).url, until: Date.now() + WAIT_MS })),
    setReminders: (on: boolean) => run(async () => setState(await call<TelegramState>('POST', { reminders: on }))),
    disconnect: () => run(async () => setState(await call<TelegramState>('DELETE'))),
  };
}
