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
