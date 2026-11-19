/** Pronunciation through the browser's built-in voices (Web Speech API). */
import { useClientValue } from './hooks';

export const speechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';

export const useSpeechSupported = () => useClientValue(speechSupported, false);

/** The voice for each language, found once (the list can be long); forgotten when the browser's voices change. */
const voiceCache = new Map<string, SpeechSynthesisVoice | null>();
let watchingVoices = false;
function voiceFor(lang: string): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!watchingVoices) {
    watchingVoices = true;
    synth.addEventListener?.('voiceschanged', () => voiceCache.clear());
  }
  if (voiceCache.has(lang)) return voiceCache.get(lang)!;
  const voices = synth.getVoices();
  if (!voices.length) return null; // not loaded yet: ask again next time
  const base = lang.split('-')[0].toLowerCase();
  const voice = voices.find((v) => v.lang === lang) || voices.find((v) => (v.lang || '').toLowerCase().startsWith(base)) || null;
  voiceCache.set(lang, voice);
  return voice;
}

/** Read `text` aloud; `slow` for beginners who want to hear every sound. */
export function speak(text: string | undefined, lang = 'de-DE', slow = false) {
  if (!text || !speechSupported()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/…/g, ''));
    u.lang = lang;
    u.rate = slow ? 0.6 : 0.88;
    const voice = voiceFor(lang);
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    /* speech not available */
  }
}

export function stopSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/**
 * Play a listening script: line after line, each speaker with their own voice where the device
 * has several, and a different pitch otherwise (a: a woman, b: a man, n: an announcer).
 * Returns stop(); `onEnd` runs once the last line was spoken (not after stop()).
 */
export function playScript(lines: { who: 'a' | 'b' | 'n'; text: string }[], lang = 'de-DE', onEnd?: () => void): () => void {
  if (!speechSupported() || !lines.length) {
    onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const base = lang.split('-')[0].toLowerCase();
  const voices = synth.getVoices().filter((v) => (v.lang || '').toLowerCase().startsWith(base));
  const voice = { a: voices[0], b: voices[1] ?? voices[0], n: voices[2] ?? voices[0] };
  const pitch = { a: 1.15, b: voices.length > 1 ? 0.95 : 0.7, n: 1 };
  let stopped = false;
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line.text);
    u.lang = lang;
    u.rate = 0.9; // A1: a little slower than normal speech
    u.pitch = pitch[line.who];
    if (voice[line.who]) u.voice = voice[line.who];
    if (i === lines.length - 1) {
      u.onend = () => !stopped && onEnd?.();
      u.onerror = () => !stopped && onEnd?.();
    }
    synth.speak(u);
  });
  return () => {
    stopped = true;
    synth.cancel();
  };
}
