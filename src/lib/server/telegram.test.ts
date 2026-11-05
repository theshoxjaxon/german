import { afterEach, describe, expect, it } from 'vitest';
import { botConfig, diagnose, hasSecret, isGone, isLinkCode, parseUpdate, reminderText, settingProblems, startLink } from './telegram';

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';
const SECRET = 'a-long-random-webhook-secret_123';
const set = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};
afterEach(() => set({ TELEGRAM_BOT_TOKEN: undefined, TELEGRAM_BOT_USERNAME: undefined, TELEGRAM_WEBHOOK_SECRET: undefined }));

describe('Telegram settings', () => {
  it('needs a well-formed token, username and secret', () => {
    expect(botConfig()).toBeNull();
    expect(settingProblems()).toHaveLength(3);
    set({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: '@KarteikastenBot', TELEGRAM_WEBHOOK_SECRET: SECRET });
    expect(botConfig()).toEqual({ token: TOKEN, username: 'KarteikastenBot', secret: SECRET }); // the @ is dropped
    expect(settingProblems()).toEqual([]);
    set({ TELEGRAM_WEBHOOK_SECRET: 'short' });
    expect(botConfig()).toBeNull();
    expect(settingProblems()).toEqual([expect.stringContaining('TELEGRAM_WEBHOOK_SECRET')]);
    set({ TELEGRAM_WEBHOOK_SECRET: SECRET, TELEGRAM_BOT_TOKEN: 'not-a-token' });
    expect(settingProblems()).toEqual(['TELEGRAM_BOT_TOKEN']); // names only, never values
  });

  it('accepts webhook requests only with the exact secret', () => {
    const cfg = { token: TOKEN, username: 'KarteikastenBot', secret: SECRET };
    expect(hasSecret(SECRET, cfg)).toBe(true);
    expect(hasSecret(null, cfg)).toBe(false);
    expect(hasSecret('', cfg)).toBe(false);
    expect(hasSecret(SECRET.slice(0, -1) + 'x', cfg)).toBe(false);
    expect(hasSecret(SECRET + 'x', cfg)).toBe(false);
    expect(hasSecret(SECRET, null)).toBe(false); // no bot set up: nothing is real
  });

  it('makes t.me start links and recognises blocked chats', () => {
    expect(startLink({ token: TOKEN, username: 'KarteikastenBot', secret: SECRET }, 'abc')).toBe('https://t.me/KarteikastenBot?start=abc');
    expect(isGone({ ok: false, code: 403, description: 'Forbidden: bot was blocked by the user' })).toBe(true);
    expect(isGone({ ok: false, code: 400, description: 'Bad Request: chat not found' })).toBe(true);
    expect(isGone({ ok: false, code: 429, description: 'Too Many Requests' })).toBe(false);
    expect(isGone({ ok: true, result: {} })).toBe(false);
    expect(isLinkCode('x'.repeat(43))).toBe(true);
    expect(isLinkCode('short')).toBe(false);
    expect(isLinkCode('has spaces in it, so it is not a code')).toBe(false);
  });
});

describe('Telegram updates', () => {
  const msg = (text: string, extra: Record<string, unknown> = {}) => ({
    update_id: 1,
    message: { message_id: 5, text, chat: { id: 777, type: 'private' }, from: { id: 777, language_code: 'uz' }, ...extra },
  });

  it('reads /start with and without a code, and /stop', () => {
    expect(parseUpdate(msg('/start abcdefghijklmnopqrstuvwxyz0123456789-_AB'))).toEqual({
      kind: 'start', chatId: 777, code: 'abcdefghijklmnopqrstuvwxyz0123456789-_AB', lang: 'uz',
    });
    expect(parseUpdate(msg('/start'))).toMatchObject({ kind: 'start', code: null });
    expect(parseUpdate(msg('/stop'))).toMatchObject({ kind: 'stop', chatId: 777 });
    expect(parseUpdate(msg('/stop@KarteikastenBot'))).toMatchObject({ kind: 'stop' });
    expect(parseUpdate(msg('salom'))).toMatchObject({ kind: 'other' });
    expect(parseUpdate(msg('/start x', { from: { language_code: 'en-GB' } }))).toMatchObject({ lang: 'en', code: 'x' });
  });

  it('reads the Stop button', () => {
    const cb = { update_id: 2, callback_query: { id: 'q1', data: 'stop', from: { id: 777 }, message: { chat: { id: 777, type: 'private' } } } };
    expect(parseUpdate(cb)).toEqual({ kind: 'stop', chatId: 777, lang: 'uz', callbackId: 'q1' });
    expect(parseUpdate({ callback_query: { ...cb.callback_query, data: 'other' } })).toBeNull();
  });

  it('ignores groups, channels and anything malformed', () => {
    expect(parseUpdate(msg('/start', { chat: { id: -100, type: 'group' } }))).toBeNull();
    expect(parseUpdate({ channel_post: { text: '/start', chat: { id: -100, type: 'channel' } } })).toBeNull();
    expect(parseUpdate(msg('/start', { chat: { id: '777', type: 'private' } }))).toBeNull(); // ids are numbers
    expect(parseUpdate(null)).toBeNull();
    expect(parseUpdate('nonsense')).toBeNull();
    expect(parseUpdate({ message: [] })).toBeNull();
  });
});

describe('the evening reminder', () => {
  it('says the streak and what waits, in Uzbek', () => {
    expect(reminderText('uz', { course: 'Nemis tili', streak: 3, due: 12, fresh: 5 })).toBe(
      '🔥 3 kunlik seriya: bugun ham davom ettiring!\nNemis tili: 12 ta takrorlash va 5 ta yangi soʻz sizni kutmoqda.\n5 daqiqa yetadi.',
    );
    expect(reminderText('uz', { course: 'Nemis tili', streak: 0, due: 0, fresh: 20 })).toBe(
      '👋 Bugun hali mashq qilmadingiz.\nNemis tili: 20 ta yangi soʻz sizni kutmoqda.\n5 daqiqa yetadi.',
    );
  });

  it('counts in English', () => {
    expect(reminderText('en', { course: 'German', streak: 1, due: 1, fresh: 0 })).toBe(
      '🔥 1-day streak: keep it going today!\nGerman: 1 review is waiting for you.\n5 minutes is enough.',
    );
    expect(reminderText('en', { course: 'German', streak: 0, due: 4, fresh: 1 })).toContain('German: 4 reviews and 1 new word are waiting for you.');
    expect(reminderText('en', { course: 'German', streak: 0, due: 0, fresh: 2 })).toContain('German: 2 new words are waiting for you.');
  });

  it('sends nothing when nothing waits, except as a test', () => {
    expect(reminderText('uz', { course: 'Nemis tili', streak: 9, due: 0, fresh: 0 })).toBeNull();
    expect(reminderText('uz', { course: 'Nemis tili', streak: 9, due: 0, fresh: 0 }, true)).toContain('(Sinov xabari)');
    expect(reminderText('en', { course: 'German', streak: 0, due: 2, fresh: 0 }, true)).toMatch(/^\(Test message\)\n/);
  });
});

describe('"Check the bot"', () => {
  const NOW = Date.parse('2026-11-05T10:40:00Z');
  const URL = 'https://german-roan.vercel.app/api/telegram/webhook';
  const good = {
    problems: [], cron: true, username: 'karteikasten_bot', expectedUrl: URL, now: NOW,
    me: { ok: true as const, result: { username: 'karteikasten_bot' } },
    hook: { ok: true as const, result: { url: URL, pending_update_count: 0 } },
  };
  const bad = (lines: { ok: boolean; label: string; fix?: string }[]) => lines.filter((l) => !l.ok);

  it('is all green when everything is right', () => {
    const lines = diagnose(good);
    expect(bad(lines)).toEqual([]);
    expect(lines.map((l) => l.label)).toContain('The token works: @karteikasten_bot');
  });

  it('says to press Connect the bot when no webhook is set', () => {
    const [line] = bad(diagnose({ ...good, hook: { ok: true, result: { url: '', pending_update_count: 3 } } }));
    expect(line.label).toMatch(/No webhook is set/);
    expect(line.fix).toMatch(/Connect the bot/);
  });

  it('notices a webhook pointing somewhere else', () => {
    const lines = bad(diagnose({ ...good, hook: { ok: true, result: { url: 'https://german-abc123.vercel.app/api/telegram/webhook' } } }));
    expect(lines[0].label).toContain('german-abc123');
    expect(lines[0].fix).toContain(URL);
  });

  it('explains a 401 from the site: the secret, or deployment protection', () => {
    const hook = { ok: true as const, result: { url: URL, pending_update_count: 2, last_error_date: NOW / 1000 - 600, last_error_message: 'Wrong response from the webhook: 401 Unauthorized' } };
    const lines = bad(diagnose({ ...good, hook }));
    expect(lines[0].label).toMatch(/10 minutes ago/);
    expect(lines[0].fix).toMatch(/secret/);
    expect(lines[0].fix).toMatch(/Deployment Protection/);
    expect(lines[1].label).toBe('2 messages waiting to be delivered');
    // An old error (fixed since) doesn't count
    expect(bad(diagnose({ ...good, hook: { ok: true, result: { ...hook.result, pending_update_count: 0, last_error_date: NOW / 1000 - 3 * 86400 } } }))).toEqual([]);
  });

  it('catches the display name used as the username', () => {
    const [line] = bad(diagnose({ ...good, username: 'GermanStudy' }));
    expect(line.label).toContain('@karteikasten_bot');
    expect(line.fix).toBe('Set TELEGRAM_BOT_USERNAME to karteikasten_bot and redeploy. Students’ Connect links use it.');
  });

  it('stops at a refused token, and names malformed settings with their fix', () => {
    const lines = diagnose({ ...good, me: { ok: false, code: 401, description: 'Unauthorized' }, hook: { ok: false, code: 401, description: 'Unauthorized' } });
    expect(bad(lines)).toEqual([expect.objectContaining({ label: 'Telegram refused the token', fix: expect.stringContaining('@BotFather') })]);
    const missing = bad(diagnose({ ...good, problems: ['TELEGRAM_WEBHOOK_SECRET (20+ letters, digits, _ or -)'], cron: false, me: null, hook: null }));
    expect(missing.map((l) => l.label)).toEqual(['TELEGRAM_WEBHOOK_SECRET is missing or malformed', 'CRON_SECRET is missing']);
    expect(missing[0].fix).toMatch(/20 or more/);
    // Nothing it says ever includes the token or the secret
    expect(JSON.stringify(diagnose(good))).not.toMatch(/AAH|secret_123/);
  });
});
