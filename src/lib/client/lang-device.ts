/**
 * The interface language kept in this browser: the copy the login and sign-up pages use before
 * the study settings are loaded. Before anyone chooses: Uzbek on Uzbek phones, else English.
 */
import { UI_LANGS, type UiLang } from '../types';

const KEY = 'kk.lang';
const listeners = new Set<() => void>();

function saved(): UiLang | null {
  try {
    const v = localStorage.getItem(KEY);
    return UI_LANGS.includes(v as UiLang) ? (v as UiLang) : null;
  } catch {
    return null;
  }
}

/** The device's language: the last choice made in this browser, or the phone's own language. */
export function deviceLang(): UiLang {
  const s = saved();
  if (s) return s;
  return typeof navigator !== 'undefined' && /^uz\b/i.test(navigator.language) ? 'uz' : 'en';
}

/** Remember a choice in this browser (the profile keeps its own copy in the study settings). */
export function rememberLang(lang: UiLang) {
  try {
    if (localStorage.getItem(KEY) === lang) return;
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage blocked: the choice lasts until the page closes */
  }
  for (const l of listeners) l();
}

export const subscribeLang = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
