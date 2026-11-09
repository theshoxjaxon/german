'use client';

import { useRef, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { createShare, sendShare, type ShareBody } from '@/lib/client/share';
import { Icon } from './ui';
import { goal } from '@/lib/client/metrica';

type State = { k: 'idle' | 'busy' | 'copied' } | { k: 'again'; url: string } | { k: 'error'; message: string };

/**
 * "Share": makes the public link once (a snapshot with your first name and the numbers), then
 * opens the phone's share sheet or copies it. `note` says what the link shows.
 */
export function ShareButton({ body, text, note, compact = false }: { body: ShareBody; text: string; note: string; compact?: boolean }) {
  const { t } = useT();
  const url = useRef<string | null>(null);
  const [state, setState] = useState<State>({ k: 'idle' });

  const deliver = async (link: string) => {
    const r = await sendShare(text, link);
    setState(r === 'copied' ? { k: 'copied' } : r === 'blocked' ? { k: 'again', url: link } : { k: 'idle' });
  };
  const onClick = async () => {
    // Once the link exists, go straight to the share sheet: no waiting, so the tap still counts
    if (url.current) return void deliver(url.current);
    setState({ k: 'busy' });
    try {
      url.current = await createShare(body);
      goal('share', { kind: body.kind });
      await deliver(url.current);
    } catch (e) {
      setState({ k: 'error', message: (e as Error).message });
    }
  };

  return (
    <div className={compact ? 'share-box is-compact' : 'share-box'}>
      <button className={compact ? 'btn btn-sm' : 'btn'} disabled={state.k === 'busy'} onClick={() => void onClick()} title={compact ? note : undefined}>
        <Icon name="share" /> {t('Share')}
      </button>
      {state.k === 'copied' && <p className="hint ok-text" role="status">{t('Link copied. Paste it in your class chat.')}</p>}
      {state.k === 'again' && (
        <>
          <input className="share-link" readOnly value={state.url} aria-label={t('Link')} onFocus={(e) => e.currentTarget.select()} />
          <p className="hint" role="status">{t('Tap Share again, or copy this link.')}</p>
        </>
      )}
      {state.k === 'error' && <p className="err" role="alert">{t(state.message)}</p>}
      {!compact && state.k !== 'copied' && <p className="hint">{note}</p>}
    </div>
  );
}
