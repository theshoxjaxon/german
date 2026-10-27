/**
 * The interface language. Signed in, it's part of your study settings, so it follows you to every
 * device; before the settings are loaded (login, sign-up) the copy kept in this browser is used.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { span, translate, translateCount, type Vars } from '../i18n';
import type { UiLang } from '../types';
import { deviceLang, subscribeLang } from './lang-device';
import { useStore } from './store';

export function useLang(): UiLang {
  const { status, prefs } = useStore();
  const device = useSyncExternalStore(subscribeLang, deviceLang, () => 'en' as UiLang);
  return (status === 'ready' && prefs.uiLang) || device;
}

/** t('Study now'), tn(3, '{n} word', '{n} words'), span(ms): in the chosen language. */
export function useT() {
  const lang = useLang();
  return useMemo(
    () => ({
      lang,
      t: (en: string, vars?: Vars) => translate(lang, en, vars),
      tn: (n: number, one: string, many: string, vars?: Vars) => translateCount(lang, n, one, many, vars),
      span: (ms: number) => span(lang, ms),
    }),
    [lang],
  );
}

/** What useT() returns, for helpers that format text outside a component. */
export type Translator = ReturnType<typeof useT>;
