/**
 * Browser side of the AI word helper: shrink a photo before upload, and call the API.
 */
import type { AiImageType, AiRequest, AiResult } from '../ai-shared';

/**
 * Phone photos are 3–12 MB. Text on a page stays readable at 2000 px on the long edge, which
 * makes the upload ~0.5 MB and the request faster and cheaper. EXIF rotation is applied.
 */
export async function prepareImage(file: File, maxEdge = 2000): Promise<{ data: string; mediaType: AiImageType; preview: string }> {
  const source = await decode(file);
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser can’t prepare the photo.');
  ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  source.close();
  const preview = canvas.toDataURL('image/jpeg', 0.85);
  return { data: preview.slice(preview.indexOf(',') + 1), mediaType: 'image/jpeg', preview };
}

async function decode(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { image: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // Older Safari: fall back to an <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
    } catch {
      throw new Error('This picture couldn’t be opened. Try a JPEG or PNG photo.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Ask the server for flashcards. Throws an Error whose message can be shown as is. */
export async function requestAiWords(body: AiRequest, signal?: AbortSignal): Promise<AiResult> {
  let res: Response;
  try {
    res = await fetch('/api/ai/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Couldn’t reach the server. Check your internet connection.');
  }
  const data = (await res.json().catch(() => null)) as (AiResult & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error || `The AI helper failed (${res.status}). Try again.`);
  return data;
}
