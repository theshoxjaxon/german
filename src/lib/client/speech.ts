/** Pronunciation through the browser's built-in voices (Web Speech API). */
import { useClientValue } from './hooks';

export const speechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';

export const useSpeechSupported = () => useClientValue(speechSupported, false);

export function speak(text: string | undefined, lang = 'de-DE') {
  if (!text || !speechSupported()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/…/g, ''));
    u.lang = lang;
    u.rate = 0.88;
    const base = lang.split('-')[0].toLowerCase();
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === lang) || voices.find((v) => (v.lang || '').toLowerCase().startsWith(base));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    /* speech not available */
  }
}

export function stopSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
