import type { Word } from './types';

export interface Lang { id: string; code: string; name: string; native: string; speech: string; on: boolean }

// Only German and English have words so far; the rest show "Coming soon".
export const LANGS: Lang[] = [
  { id: 'de', code: 'DE', name: 'German', native: 'Deutsch', speech: 'de-DE', on: true },
  { id: 'en', code: 'EN', name: 'English', native: 'English', speech: 'en-US', on: true },
  { id: 'es', code: 'ES', name: 'Spanish', native: 'Español', speech: 'es-MX', on: false },
  { id: 'ja', code: 'JA', name: 'Japanese', native: '日本語', speech: 'ja-JP', on: false },
  { id: 'uz', code: 'UZ', name: 'Uzbek', native: 'O’zbekcha', speech: 'uz-UZ', on: false },
  { id: 'fr', code: 'FR', name: 'French', native: 'Français', speech: 'fr-FR', on: false },
  { id: 'ko', code: 'KO', name: 'Korean', native: '한국어', speech: 'ko-KR', on: false },
  { id: 'it', code: 'IT', name: 'Italian', native: 'Italiano', speech: 'it-IT', on: false },
];

// ponytail: no language column; decks named "English …" are English, everything else is German.
export const langOf = (w: Pick<Word, 'deck'>) => (/^english/i.test(w.deck || '') ? 'en' : 'de');
