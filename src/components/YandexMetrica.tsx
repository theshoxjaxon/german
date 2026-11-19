'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { hit, isExcluded, loadMetrica, METRICA_ID } from '@/lib/client/metrica';

/**
 * Yandex Metrica for the whole site (see src/lib/client/metrica.ts): loads the tag once and sends
 * a page view whenever the address changes, since the app moves between pages without reloading.
 * Renders nothing; does nothing without NEXT_PUBLIC_YANDEX_METRICA_ID, or on excluded pages.
 */
export function YandexMetrica() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!METRICA_ID || isExcluded(pathname)) return;
    loadMetrica();
    const here = window.location.href;
    hit(here, last.current ?? document.referrer);
    last.current = here;
  }, [pathname]);
  return null;
}
