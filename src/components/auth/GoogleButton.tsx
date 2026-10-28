'use client';

/**
 * "Continue with Google": Google's own button (Google Identity Services), so it looks and works
 * the way people know. It opens Google's sign-in in a popup and hands back an ID token, which
 * goes straight to POST /api/auth/google to be checked. Nothing is kept in the browser: the
 * server answers with the usual session cookie (HttpOnly). Without NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * the button and the "or" line don't show, and the email form works on its own.
 */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { visitorId } from '@/lib/client/visitor';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface Gsi {
  accounts: { id: { initialize(options: object): void; renderButton(el: HTMLElement, options: object): void } };
}
declare global {
  interface Window {
    google?: Gsi;
  }
}

/** Load Google's script once per page. */
let loading: Promise<Gsi> | null = null;
function loadGsi(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  loading ??= new Promise<Gsi>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('no gsi')));
    s.onerror = () => {
      loading = null; // a later page can try again
      reject(new Error('gsi blocked'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function GoogleButton() {
  const box = useRef<HTMLDivElement>(null);
  const { t, lang } = useT();
  const [status, setStatus] = useState<'loading' | 'ready' | 'busy' | 'unavailable'>('loading');
  const [error, setError] = useState('');

  const signIn = useEffectEvent(async (credential: string) => {
    setStatus('busy');
    setError('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          next: new URLSearchParams(window.location.search).get('next') ?? '/',
          visitor: visitorId() ?? undefined, // links this browser's guest visits to a new profile
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { next?: string; error?: string };
      if (res.ok) {
        window.location.assign(data.next || '/'); // a full load, like the email login
        return;
      }
      setError(data.error || 'Google sign-in failed. Try again.');
    } catch {
      setError('Could not reach the server. Check your internet connection, then try again.');
    }
    setStatus('ready');
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let live = true;
    let stop = () => {};
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    loadGsi().then(
      (gsi) => {
        if (!live) return;
        gsi.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          callback: (r: { credential?: string }) => r.credential && signIn(r.credential),
        });
        const draw = () => {
          const el = box.current;
          if (!el || !live) return;
          el.replaceChildren();
          gsi.accounts.id.renderButton(el, {
            type: 'standard',
            theme: dark.matches ? 'filled_black' : 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            logo_alignment: 'center',
            width: Math.max(200, Math.min(400, el.clientWidth)),
            locale: lang,
          });
          setStatus((s) => (s === 'busy' ? s : 'ready'));
        };
        draw();
        dark.addEventListener('change', draw); // follow the dark mode switch
        stop = () => dark.removeEventListener('change', draw);
      },
      () => live && setStatus('unavailable'),
    );
    return () => {
      live = false;
      stop();
    };
  }, [lang]);

  if (!CLIENT_ID) return null;
  return (
    <div className="gsi">
      <div ref={box} className="gsi-box" aria-busy={status === 'loading' || status === 'busy'} hidden={status === 'unavailable'} />
      <p className="gsi-status" role="status">
        {status === 'busy' ? t('Signing you in with Google…') : status === 'unavailable' ? t('Google sign-in couldn’t load here. Use your email below.') : ''}
      </p>
      {error && <p className="err center" role="alert">{t(error)}</p>}
      <p className="auth-or"><span>{t('or')}</span></p>
    </div>
  );
}
