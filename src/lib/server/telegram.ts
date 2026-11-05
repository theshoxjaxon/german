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

/** The token alone, when it looks right: enough to ask Telegram what's wrong while other settings aren't. */
export function tokenConfig(): BotConfig | null {
  const token = env('TELEGRAM_BOT_TOKEN');
  return TOKEN_RE.test(token) ? { token, username: '', secret: '' } : null;
}

/** TELEGRAM_BOT_USERNAME as set, without a leading @ ('' when missing). */
export const configuredUsername = () => env('TELEGRAM_BOT_USERNAME').replace(/^@/, '');

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

/* ============================== "Check the bot" (/admin) ============================== */

/** One line of the check: what's right or wrong, and what to do about it. */
export interface CheckLine {
  ok: boolean;
  label: string;
  fix?: string;
}

/** The part of Telegram's getWebhookInfo the check reads. */
export interface WebhookInfo {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number; // Unix seconds
  last_error_message?: string;
}

const SETTING_FIX: Record<string, string> = {
  TELEGRAM_BOT_TOKEN: 'Copy the token from @BotFather (it looks like 123456789:AA…), with no quotes or spaces, add it in Vercel for Production and redeploy.',
  TELEGRAM_BOT_USERNAME: 'Use the bot’s @username without the @ (for example karteikasten_bot), not its display name. Then redeploy.',
  TELEGRAM_WEBHOOK_SECRET: 'Use 20 or more letters, digits, _ or - only (for example the output of `openssl rand -hex 24`). Then redeploy.',
};

function ago(seconds: number): string {
  if (seconds < 90) return 'just now';
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)} minutes ago`;
  if (seconds < 36 * 3600) return `${Math.round(seconds / 3600)} hours ago`;
  return `${Math.round(seconds / 86400)} days ago`;
}

/** What a webhook delivery error means, and the fix. */
function deliveryFix(message: string): string {
  if (/\b40[13]\b|unauthori[sz]ed|forbidden/i.test(message)) {
    return 'The site refused Telegram: the webhook secret doesn’t match (it changed, or the site wasn’t redeployed after setting it). Redeploy, then press Connect the bot again. If it stays, check Vercel → Settings → Deployment Protection: your live address must not be protected.';
  }
  if (/\b404\b|not found/i.test(message)) return 'The site has no webhook at that address: the latest code may not be deployed. Redeploy, then press Connect the bot.';
  if (/\b5\d\d\b|internal server/i.test(message)) return 'The site failed while handling the message. Look at Vercel → Logs for /api/telegram/webhook.';
  if (/time(d)? ?out|connect|resolve|ssl|certificate|host/i.test(message)) return 'Telegram couldn’t reach the site at that address. If APP_URL is set, it must be your live https address; then press Connect the bot.';
  return 'Look at Vercel → Logs for /api/telegram/webhook around that time.';
}

/**
 * The checklist behind "Check the bot": settings, the token, where the webhook points, and the
 * last error Telegram had delivering to it. Pure, so every case is tested; the token and the
 * secret never appear in it.
 */
export function diagnose(input: {
  problems: string[]; // settingProblems()
  cron: boolean; // CRON_SECRET is set
  username: string; // TELEGRAM_BOT_USERNAME as set
  me: TgResult<{ username?: string }> | null; // getMe; null when there's no usable token
  hook: TgResult<WebhookInfo> | null; // getWebhookInfo; null likewise
  expectedUrl: string; // <site>/api/telegram/webhook
  now: number; // ms
}): CheckLine[] {
  const lines: CheckLine[] = [];
  for (const p of input.problems) {
    const name = p.split(' ')[0];
    lines.push({ ok: false, label: `${name} is missing or malformed`, fix: SETTING_FIX[name] });
  }
  if (!input.problems.length) lines.push({ ok: true, label: 'The three Telegram settings are there' });
  lines.push(input.cron
    ? { ok: true, label: 'CRON_SECRET is set, so the evening job can run' }
    : { ok: false, label: 'CRON_SECRET is missing', fix: 'Add any long random value in Vercel and redeploy: without it no reminders or quizzes go out.' });

  const me = input.me;
  if (me && !me.ok) {
    lines.push({ ok: false, label: 'Telegram refused the token', fix: `Telegram said: “${me.description}”. Copy the token again from @BotFather (or Revoke it and use the new one), update it in Vercel and redeploy.` });
    return lines; // nothing else can be checked without a working token
  }
  if (me?.ok) {
    const real = me.result.username ?? '';
    if (real && real.toLowerCase() !== input.username.toLowerCase()) {
      lines.push({ ok: false, label: `The token belongs to @${real}, but TELEGRAM_BOT_USERNAME is “${input.username || '(empty)'}”`, fix: `Set TELEGRAM_BOT_USERNAME to ${real} and redeploy. Students’ Connect links use it.` });
    } else {
      lines.push({ ok: true, label: `The token works: @${real}` });
    }
  }

  const hook = input.hook;
  if (!hook) return lines;
  if (!hook.ok) {
    lines.push({ ok: false, label: 'Couldn’t read the webhook from Telegram', fix: `Telegram said: “${hook.description}”. Try again in a minute.` });
    return lines;
  }
  const info = hook.result;
  const url = info.url ?? '';
  if (!url) {
    lines.push({ ok: false, label: 'No webhook is set, so Telegram keeps messages to itself and the bot never answers', fix: 'Press Connect the bot, then send /start to the bot again.' });
  } else if (url !== input.expectedUrl) {
    lines.push({ ok: false, label: `The webhook points at ${url}`, fix: `Press Connect the bot to point it at ${input.expectedUrl}.` });
  } else {
    lines.push({ ok: true, label: `The webhook points at this site (${url})` });
  }
  const errorAge = info.last_error_date ? input.now / 1000 - info.last_error_date : null;
  if (url && info.last_error_message && errorAge != null && errorAge < 24 * 3600) {
    lines.push({ ok: false, label: `Telegram’s last delivery failed ${ago(errorAge)}: “${info.last_error_message}”`, fix: deliveryFix(info.last_error_message) });
  } else if (url) {
    lines.push({ ok: true, label: 'No delivery errors in the last day' });
  }
  const pending = info.pending_update_count ?? 0;
  if (url && pending > 0) {
    lines.push({ ok: false, label: `${pending} message${pending === 1 ? '' : 's'} waiting to be delivered`, fix: 'Telegram retries on its own. If this number keeps growing, fix the error above.' });
  }
  return lines;
}
