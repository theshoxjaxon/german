/**
 * Shared by the AI word helper's server and client: languages and limits.
 * (The model call itself is server-only: src/lib/server/ai.ts.)
 */
import type { WordData } from './types';

/** Languages the meanings and example translations can be written in. */
export const AI_LANGUAGES = [
  { code: 'en', label: 'English', prompt: 'English' },
  { code: 'uz', label: 'O‘zbekcha', prompt: 'Uzbek (Latin script)' },
  { code: 'ru', label: 'Русский', prompt: 'Russian' },
] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number]['code'];
export const isAiLanguage = (v: unknown): v is AiLanguage => AI_LANGUAGES.some((l) => l.code === v);

export const AI_MAX_TEXT = 4000; // characters in a typed list
export const AI_MAX_LINES = 80;
export const AI_MAX_IMAGE_CHARS = 8_000_000; // base64 length (≈ 6 MB); the app sends ~0.5 MB
export const AI_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type AiImageType = (typeof AI_IMAGE_TYPES)[number];

/** One word as the AI suggests it, before it gets a deck and an id. */
export type AiWord = Pick<WordData, 'term' | 'meaning' | 'pos' | 'pronunciation' | 'forms' | 'example' | 'exampleTr' | 'mnemonic' | 'tags'>;

export interface AiRequest {
  mode: 'photo' | 'text';
  language: AiLanguage;
  image?: { data: string; mediaType: AiImageType }; // photo mode, base64 without the data: prefix
  text?: string; // text mode: one word per line, optionally "word – meaning"
}

export interface AiResult {
  topic: string; // the lesson title seen in the photo, or ''
  note: string; // why nothing was found, or ''
  words: AiWord[];
}
