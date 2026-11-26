/** Small helpers every repository uses to read database rows. */
import { dayKey, safeTimeZone } from '@/lib/stats';

export const TIMEZONE = safeTimeZone(process.env.APP_TIMEZONE);
export const todayKey = (now = Date.now()) => dayKey(now, TIMEZONE);

export const str = (v: unknown) => (v == null ? '' : String(v));
export const num = (v: unknown) => (v == null ? 0 : Number(v));
/** JSONB columns arrive already parsed; tolerate text too. */
export const parse = <T>(v: unknown): T | null => {
  if (v == null) return null;
  if (typeof v !== 'string') return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};
export const FOREIGN_KEY_VIOLATION = '23503';

export const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === '23505' || /unique/i.test(String((e as Error).message));
