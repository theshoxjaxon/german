'use client';

import { useEffect } from 'react';

/** Paints the page dark while a Wordfield screen is on screen, and puts it back when it leaves. */
export function WfTheme() {
  useEffect(() => {
    document.documentElement.classList.add('wf-on');
    return () => document.documentElement.classList.remove('wf-on');
  }, []);
  return null;
}
