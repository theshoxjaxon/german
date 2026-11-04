/**
 * The Telegram bot: its settings, one function to call the Bot API (plain HTTPS, no SDK), the
 * messages it sends (Uzbek and English), and reading the updates Telegram sends to the webhook.
 * Nothing here touches the database: see reminders.ts for that.
 *
 * Settings, from the environment:
 *   TELEGRAM_BOT_TOKEN       from @BotFather. Never sent to the browser and never logged.
 *   TELEGRAM_BOT_USERNAME    the bot's @name, for t.me links
 *   TELEGRAM_WEBHOOK_SECRET  20–256 letters, digits, _ or -. Telegram sends it back with every
 *                            update, so the webhook can tell real updates from forged ones.
 *   TELEGRAM_API_BASE        tests only: a local stand-in for https://api.telegram.org
 */
import { timingSafeEqual } from 'node:crypto';
import type { UiLang } from '../types';

export interface BotConfig {
  token: string;
  username: string;
  secret: string;
}

const TOKEN_RE = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{20,256}$/;

const env = (name: string) => process.env[name]?.trim() ?? '';

/** The bot's settings, or null while any of them is missing or malformed. */
export function botConfig(): BotConfig | null {
  const token = env('TELEGRAM_BOT_TOKEN');
  const username = env('TELEGRAM_BOT_USERNAME').replace(/^@/, '');
  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  if (!TOKEN_RE.test(token) || !USERNAME_RE.test(username) || !SECRET_RE.test(secret)) return null;
  return { token, username, secret };
}

/** Which settings are missing or malformed: names only, never values (for the admin page). */
export function settingProblems(): string[] {
  const out: string[] = [];
  if (!TOKEN_RE.test(env('TELEGRAM_BOT_TOKEN'))) out.push('TELEGRAM_BOT_TOKEN');
  if (!USERNAME_RE.test(env('TELEGRAM_BOT_USERNAME').replace(/^@/, ''))) out.push('TELEGRAM_BOT_USERNAME');
  if (!SECRET_RE.test(env('TELEGRAM_WEBHOOK_SECRET'))) out.push('TELEGRAM_WEBHOOK_SECRET (20+ letters, digits, _ or -)');
  return out;
}

/** Whether a webhook request carries the secret (X-Telegram-Bot-Api-Secret-Token), compared in constant time. */
export function hasSecret(header: string | null, cfg: BotConfig | null): boolean {
  if (!cfg) return false;
  const given = Buffer.from(header ?? '');
  const want = Buffer.from(cfg.secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export type TgResult<T> = { ok: true; result: T } | { ok: false; code: number; description: string };

/** One Bot API method. Errors come back as values (Telegram's code and text), never as throws. */
export async function call<T = unknown>(method: string, body: Record<string, unknown>, cfg = botConfig()): Promise<TgResult<T>> {
  if (!cfg) return { ok: false, code: 0, description: 'The bot is not set up.' };
  const base = (env('TELEGRAM_API_BASE') || 'https://api.telegram.org').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/bot${cfg.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; error_code?: number; description?: string } | null;
    if (data?.ok) return { ok: true, result: data.result as T };
    return { ok: false, code: data?.error_code ?? res.status, description: String(data?.description ?? `HTTP ${res.status}`).slice(0, 200) };
  } catch (e) {
    return { ok: false, code: 0, description: (e as Error).name === 'TimeoutError' ? 'Telegram did not answer in time.' : 'Could not reach Telegram.' };
  }
}

/** Telegram stopped delivering to this chat for good: the person blocked the bot or deleted the chat. */
export const isGone = (r: TgResult<unknown>) => !r.ok && (r.code === 403 || (r.code === 400 && /chat not found/i.test(r.description)));

/** The link that opens the bot with a one-time code: pressing Start sends `/start <code>`. */
export const startLink = (cfg: BotConfig, code: string) => `https://t.me/${cfg.username}?start=${code}`;

/* ============================== the messages ============================== */

/** What the bot says, in the person's interface language. {n}-style values are filled in below. */
const COPY = {
  uz: {
    open: 'Ochish',
    stop: 'Eslatmani toʻxtatish',
    linked: '✅ Ulandi! Har kuni kechqurun, agar oʻsha kuni mashq qilmagan boʻlsangiz, eslatma yuboraman.\nToʻxtatish: /stop',
    badLink: 'Bu havola eskirgan yoki allaqachon ishlatilgan. Ilovada Sozlamalar → Telegram’ni oching va qaytadan bosing.',
    hello: 'Salom! Bu Karteikasten boti: mashq qilish vaqti kelganda eslatib turaman.\nUlash uchun ilovada Sozlamalar → Telegram → “Ulash” tugmasini bosing.',
    resumed: '🔔 Eslatmalar yoqildi. Toʻxtatish: /stop',
    stopped: '🔕 Eslatmalar toʻxtatildi. Qayta yoqish: /start',
    help: 'Men kechqurun mashq eslatmasini yuboraman. Toʻxtatish: /stop · Yoqish: /start',
    streak: '🔥 {n} kunlik seriya: bugun ham davom ettiring!',
    noStreak: '👋 Bugun hali mashq qilmadingiz.',
    both: '{course}: {due} ta takrorlash va {fresh} ta yangi soʻz sizni kutmoqda.',
    due: '{course}: {due} ta takrorlash sizni kutmoqda.',
    fresh: '{course}: {fresh} ta yangi soʻz sizni kutmoqda.',
    enough: '5 daqiqa yetadi.',
    test: '(Sinov xabari)',
    nothing: 'Bugun uchun hamma kartochkalar tugagan.',
  },
  en: {
    open: 'Open the app',
    stop: 'Stop reminders',
    linked: '✅ Connected! Each evening, if you haven’t practised that day, I’ll send you a reminder.\nTo stop: /stop',
    badLink: 'This link has expired or was already used. Open Settings → Telegram in the app and press Connect again.',
    hello: 'Hi! This is the Karteikasten bot: I remind you when it’s time to practise.\nTo connect, open Settings → Telegram → “Connect” in the app.',
    resumed: '🔔 Reminders are on. To stop: /stop',
    stopped: '🔕 Reminders stopped. To turn them on again: /start',
    help: 'I send a practice reminder in the evening. Stop: /stop · Turn on: /start',
    streak: '🔥 {n}-day streak: keep it going today!',
    noStreak: '👋 You haven’t practised today yet.',
    both: '{course}: {due} and {fresh} are waiting for you.',
    due: '{course}: {due} {verb} waiting for you.',
    fresh: '{course}: {fresh} {verb} waiting for you.',
    enough: '5 minutes is enough.',
    test: '(Test message)',
    nothing: 'All of today’s cards are done.',
  },
} satisfies Record<UiLang, Record<string, string>>;

export type BotText = 'linked' | 'badLink' | 'hello' | 'resumed' | 'stopped' | 'help';
export const botText = (lang: UiLang, key: BotText) => COPY[lang][key];

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
const enCount = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface ReminderNumbers {
  course: string; // "Nemis tili", already in the person's language
  streak: number; // days in a row, up to yesterday
  due: number; // reviews and learning cards due today
  fresh: number; // new words left for today
}

/** The evening reminder, or null when there is nothing to study today. */
export function reminderText(lang: UiLang, n: ReminderNumbers, test = false): string | null {
  const c = COPY[lang];
  if (n.due <= 0 && n.fresh <= 0) return test ? `${c.test}\n${c.nothing}` : null;
  const due = lang === 'en' ? enCount(n.due, 'review', 'reviews') : n.due;
  const fresh = lang === 'en' ? enCount(n.fresh, 'new word', 'new words') : n.fresh;
  const body = n.due > 0 && n.fresh > 0 ? c.both : n.due > 0 ? c.due : c.fresh;
  const verb = (n.due > 0 ? n.due : n.fresh) === 1 ? 'is' : 'are';
  return [
    test ? c.test : '',
    n.streak > 0 ? fill(c.streak, { n: n.streak }) : c.noStreak,
    fill(body, { course: n.course, due, fresh, verb }),
    c.enough,
  ].filter(Boolean).join('\n');
}

/** The buttons under a reminder: open the app, or stop the reminders (handled by the webhook). */
export const reminderButtons = (lang: UiLang, appUrl: string) => ({
  inline_keyboard: [[{ text: COPY[lang].open, url: `${appUrl}/app` }], [{ text: COPY[lang].stop, callback_data: 'stop' }]],
});
export const openButton = (lang: UiLang, appUrl: string) => ({ inline_keyboard: [[{ text: COPY[lang].open, url: `${appUrl}/app` }]] });

/* ============================== updates from Telegram ============================== */

/** What a person did in the bot's chat. Only private chats count; everything else is ignored. */
export type BotEvent =
  | { kind: 'start'; chatId: number; code: string | null; lang: UiLang } // code: what followed /start, if anything
  | { kind: 'stop'; chatId: number; lang: UiLang; callbackId?: string }
  | { kind: 'other'; chatId: number; lang: UiLang };

/** A one-time connect code as made by the app (anything else can't be one, so isn't looked up). */
export const isLinkCode = (v: string) => /^[A-Za-z0-9_-]{20,64}$/.test(v);
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
/** The language Telegram reports for the person, until we know their app setting: Uzbek unless English. */
const langOfFrom = (from: Obj | null): UiLang => (typeof from?.language_code === 'string' && /^en\b/i.test(from.language_code) ? 'en' : 'uz');

export function parseUpdate(update: unknown): BotEvent | null {
  const u = obj(update);
  const cb = obj(u?.callback_query);
  if (cb) {
    const chat = obj(obj(cb.message)?.chat);
    const chatId = chat?.id;
    if (cb.data !== 'stop' || chat?.type !== 'private' || !Number.isSafeInteger(chatId) || typeof cb.id !== 'string') return null;
    return { kind: 'stop', chatId: chatId as number, lang: langOfFrom(obj(cb.from)), callbackId: cb.id };
  }
  const msg = obj(u?.message);
  const chat = obj(msg?.chat);
  const chatId = chat?.id;
  if (!msg || chat?.type !== 'private' || !Number.isSafeInteger(chatId)) return null;
  const lang = langOfFrom(obj(msg.from));
  const text = typeof msg.text === 'string' ? msg.text.trim() : '';
  const start = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(text);
  if (start) return { kind: 'start', chatId: chatId as number, code: start[1] ?? null, lang };
  if (/^\/stop(?:@\w+)?$/.test(text)) return { kind: 'stop', chatId: chatId as number, lang };
  return { kind: 'other', chatId: chatId as number, lang };
}
