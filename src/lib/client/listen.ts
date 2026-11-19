/**
 * Speech to text for the speaking tasks, through the browser's speech recognition (Chrome and
 * Safari; the audio goes to the browser maker's service). Where it isn't available, students type.
 */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const recognitionSupported = () => recognitionClass() !== null;

/**
 * Listen until stopped. `onText` gets each finished phrase, `onInterim` what is being heard right
 * now. Returns stop(). `onEnd` runs when listening stops for any reason.
 */
export function listen(lang: string, h: { onText: (t: string) => void; onInterim: (t: string) => void; onEnd: () => void; onError: (code: string) => void }) {
  const Rec = recognitionClass();
  if (!Rec) {
    h.onError('not-supported');
    h.onEnd();
    return () => {};
  }
  const rec = new Rec();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) h.onText(r[0].transcript.trim());
      else interim += r[0].transcript;
    }
    h.onInterim(interim);
  };
  rec.onerror = (e) => h.onError(e.error);
  rec.onend = () => {
    h.onInterim('');
    h.onEnd();
  };
  try {
    rec.start();
  } catch {
    h.onError('start');
    h.onEnd();
  }
  return () => rec.stop();
}
