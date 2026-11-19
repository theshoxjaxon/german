/**
 * What a study-chat message may contain: plain text up to 500 characters, nothing that leads
 * outside the app. No links, email addresses or phone numbers, so nobody can be lured somewhere
 * else or contacted privately through the chat. Checked on the server; the browser uses the same
 * rules to explain a refusal before sending.
 */
export const MAX_MESSAGE = 500;

const LINK = /(https?:\/\/|www\.|t\.me\/|\b[a-z0-9-]+\.(com|uz|ru|org|net|io|me|app|dev|info|link|xyz|ly|gg|tv|co|de|site|online|shop|click)\b)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\s\-().]*){9,}/;
const HANDLE = /(^|\s)@[a-z0-9_.]{3,}/i; // Telegram / Instagram names

export type MessageCheck = { ok: true; body: string } | { ok: false; error: string };

/** Tidy a message (control characters, spaces, blank lines) and check it. */
export function checkMessage(raw: unknown): MessageCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'Write a message first.' };
  const body = raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!body) return { ok: false, error: 'Write a message first.' };
  if ([...body].length > MAX_MESSAGE) return { ok: false, error: 'That message is too long (500 characters at most).' };
  if (LINK.test(body) || EMAIL.test(body) || PHONE.test(body) || HANDLE.test(body)) {
    return { ok: false, error: 'Links, email addresses, phone numbers and usernames aren’t allowed in study chats.' };
  }
  return { ok: true, body };
}
