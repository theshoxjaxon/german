/**
 * The daily reminder on Telegram: connecting a profile to a Telegram chat, the switches in
 * Settings, what the bot answers, and the evening send (/api/cron/daily).
 *
 * Privacy:
 *  - a chat id is only ever read to send that person their own reminder; no page shows it,
 *    admins included (they see counts only)
 *  - a reminder carries only the person's own numbers: their streak and how many cards wait
 *  - connect codes are one-time, expire after LINK_MINUTES, and only their SHA-256 is stored
 */
import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { LANGS } from '@/lib/courses';
import { translate } from '@/lib/i18n';
import { buildQueue } from '@/lib/queue';
import { UiLang } from '@/lib/types';
import { botConfig, botText, call, isGone, isLinkCode, openButton, parseUpdate, reminderButtons, reminderText, startLink, type BotConfig, type ReminderNumbers } from '@api/telegram/telegram';
import { Database } from '@api/database/database.service';
import { todayKey } from '@api/common/db-util';
import { CardsRepository } from '@api/cards/cards.repository';
import { CoursesRepository } from '@api/courses/courses.repository';
import { UsersRepository } from '@api/users/users.repository';
import { WordsRepository } from '@api/words/words.repository';

export const LINK_MINUTES = 15;

const str = (v: unknown) => (v == null ? '' : String(v));

const num = (v: unknown) => (v == null ? 0 : Number(v));

const hash = (code: string) => createHash('sha256').update(code).digest('hex');

export interface TelegramState {
  available: boolean; // the bot is set up on this server
  linked: boolean;
  reminders: boolean;
}

export interface SendReport {
  sent: number;
  nothingToDo: number;
  failed: number;
}

@Injectable()
export class RemindersService {
  constructor(
    private readonly database: Database,
    private readonly cardsRepo: CardsRepository,
    private readonly coursesRepo: CoursesRepository,
    private readonly usersRepo: UsersRepository,
    private readonly wordsRepo: WordsRepository,
  ) {}

  async telegramState(userId: string): Promise<TelegramState> {
    const db = await this.database.get();
    const r = await db.query('SELECT reminders FROM telegram_links WHERE user_id = $1', [userId]);
    return { available: !!botConfig(), linked: r.rows.length > 0, reminders: r.rows[0]?.reminders === true };
  }

  /** A one-time t.me link that connects whoever presses Start to this profile. Replaces older codes. */
  async createLink(userId: string, cfg: BotConfig, now = Date.now()): Promise<string> {
    const db = await this.database.get();
    const code = randomBytes(32).toString('base64url'); // 43 characters: Telegram allows up to 64
    await db.query(
      `WITH old AS (DELETE FROM telegram_link_tokens WHERE user_id = $2 OR expires_at < $3)
       INSERT INTO telegram_link_tokens (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
      [hash(code), userId, now, now + LINK_MINUTES * 60_000],
    );
    return startLink(cfg, code);
  }

  /**
   * Start pressed with a code: the code is used up and the chat is tied to its profile, with
   * reminders on. A chat belongs to one profile, so it moves from any profile it was tied to.
   * Returns the profile's id, or null for an unknown, used or expired code.
   */
  async redeemLink(code: string, chatId: number, now = Date.now()): Promise<string | null> {
    if (!isLinkCode(code)) return null;
    const db = await this.database.get();
    const t = await db.query(
      `UPDATE telegram_link_tokens SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING user_id`,
      [hash(code), now],
    );
    const userId = t.rows[0]?.user_id;
    if (!userId) return null;
    await db.query('DELETE FROM telegram_links WHERE chat_id = $1 AND user_id <> $2', [chatId, str(userId)]);
    await db.query(
      `INSERT INTO telegram_links (user_id, chat_id, reminders, linked_at) VALUES ($1, $2, true, $3)
       ON CONFLICT (user_id) DO UPDATE SET chat_id = excluded.chat_id, reminders = true, linked_at = excluded.linked_at`,
      [str(userId), chatId, now],
    );
    return str(userId);
  }

  /** Reminders on or off from Settings. False when this profile isn't connected. */
  async setReminders(userId: string, on: boolean): Promise<boolean> {
    const db = await this.database.get();
    const r = await db.query('UPDATE telegram_links SET reminders = $2 WHERE user_id = $1 RETURNING 1', [userId, on]);
    return r.rows.length > 0;
  }

  /** Disconnect: forget the chat. */
  async unlink(userId: string): Promise<void> {
    const db = await this.database.get();
    await db.query('DELETE FROM telegram_links WHERE user_id = $1', [userId]);
  }

  /** Reminders on or off from the bot's chat (/start, /stop, the Stop button). Null when the chat isn't connected. */
  async setRemindersByChat(chatId: number, on: boolean): Promise<{ userId: string } | null> {
    const db = await this.database.get();
    const r = await db.query('UPDATE telegram_links SET reminders = $2 WHERE chat_id = $1 RETURNING user_id', [chatId, on]);
    return r.rows[0] ? { userId: str(r.rows[0].user_id) } : null;
  }

  /** The language a connected person chose in the app (Uzbek until they choose). */
  async langOf(userId: string, fallback: UiLang): Promise<UiLang> {
    return (await this.cardsRepo.getPrefs(userId)).uiLang ?? fallback;
  }

  /** Answers one update from Telegram (the webhook). Never repeats what the person wrote. */
  async handleUpdate(update: unknown, appUrl: string, now = Date.now()): Promise<void> {
    const e = parseUpdate(update);
    if (!e) return;
    const say = (text: string, buttons?: unknown) => call('sendMessage', { chat_id: e.chatId, text, ...(buttons ? { reply_markup: buttons } : {}) });

    if (e.kind === 'start' && e.code) {
      const userId = await this.redeemLink(e.code, e.chatId, now);
      if (!userId) return void (await say(botText(e.lang, 'badLink'), openButton(e.lang, appUrl)));
      const lang = await this.langOf(userId, e.lang);
      return void (await say(botText(lang, 'linked'), openButton(lang, appUrl)));
    }
    if (e.kind === 'start') {
      const back = await this.setRemindersByChat(e.chatId, true);
      if (!back) return void (await say(botText(e.lang, 'hello'), openButton(e.lang, appUrl)));
      return void (await say(botText(await this.langOf(back.userId, e.lang), 'resumed')));
    }
    if (e.kind === 'stop') {
      const was = await this.setRemindersByChat(e.chatId, false);
      const lang = was ? await this.langOf(was.userId, e.lang) : e.lang;
      if (e.callbackId) await call('answerCallbackQuery', { callback_query_id: e.callbackId });
      return void (await say(botText(lang, was ? 'stopped' : 'hello'), was ? undefined : openButton(lang, appUrl)));
    }
    // Anything else: say what the bot is for
    const db = await this.database.get();
    const r = await db.query('SELECT user_id FROM telegram_links WHERE chat_id = $1', [e.chatId]);
    if (!r.rows[0]) return void (await say(botText(e.lang, 'hello'), openButton(e.lang, appUrl)));
    const lang = await this.langOf(str(r.rows[0].user_id), e.lang);
    await say(botText(lang, 'help'), openButton(lang, appUrl));
  }

  /** What someone has waiting today, worked out exactly as the app's home screen does it. */
  async numbersFor(user: { id: string; courseId: string }, lang: UiLang, now = Date.now()): Promise<ReminderNumbers> {
    const [words, cards, prefs, course, streak] = await Promise.all([
      this.wordsRepo.listWords(user.id, user.courseId),
      this.cardsRepo.listCards(user.id, user.courseId),
      this.cardsRepo.getPrefs(user.id),
      this.coursesRepo.getCourse(user.courseId),
      this.cardsRepo.myStreak(user.id, now),
    ]);
    const q = buildQueue(
      { words: new Map(Object.entries(words)), cards: new Map(Object.entries(cards)), prefs, classLesson: course?.currentLesson, course },
      now,
    );
    return {
      course: translate(lang, LANGS[course?.targetLang ?? 'de'].name),
      streak: streak.days,
      due: q.counts.review + q.counts.learning,
      fresh: q.counts.fresh,
    };
  }

  /**
   * Everyone with reminders on who hasn't studied today gets one message, at most once a day:
   * the day is claimed before sending, so a second run (or a retried cron) never sends twice.
   * When Telegram says the person blocked the bot, their reminders go off.
   */
  async sendDailyReminders(appUrl: string, now = Date.now()): Promise<SendReport> {
    const report: SendReport = { sent: 0, nothingToDo: 0, failed: 0 };
    if (!botConfig()) return report;
    const db = await this.database.get();
    const today = todayKey(now);
    const r = await db.query(
      `SELECT l.user_id FROM telegram_links l
       WHERE l.reminders AND l.last_sent_day IS DISTINCT FROM $1
         AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.user_id = l.user_id AND a.day = $1 AND a.answers > 0)`,
      [today],
    );
    const ids = r.rows.map((row) => str(row.user_id));
    // A few at a time: well under Telegram's limit of 30 messages a second
    for (let i = 0; i < ids.length; i += 5) {
      await Promise.all(ids.slice(i, i + 5).map(async (id) => {
        const out = await this.remind(id, appUrl, today, now).catch(() => 'failed' as const);
        if (out === 'sent') report.sent++;
        else if (out === 'nothing') report.nothingToDo++;
        else report.failed++;
      }));
    }
    return report;
  }

  async remind(userId: string, appUrl: string, today: string, now: number): Promise<'sent' | 'nothing' | 'failed'> {
    const user = await this.usersRepo.findUserById(userId);
    if (!user) return 'nothing';
    const lang = await this.langOf(userId, 'uz');
    const text = reminderText(lang, await this.numbersFor(user, lang, now));
    if (!text) return 'nothing';
    const db = await this.database.get();
    const claim = await db.query(
      `UPDATE telegram_links SET last_sent_day = $2 WHERE user_id = $1 AND reminders AND last_sent_day IS DISTINCT FROM $2 RETURNING chat_id`,
      [userId, today],
    );
    const chatId = claim.rows[0]?.chat_id;
    if (chatId == null) return 'nothing'; // another run got there first, or reminders just went off
    const res = await call('sendMessage', { chat_id: num(chatId), text, reply_markup: reminderButtons(lang, appUrl) });
    if (res.ok) return 'sent';
    if (isGone(res)) await db.query('UPDATE telegram_links SET reminders = false WHERE user_id = $1', [userId]);
    return 'failed';
  }

  /** An admin's "Send me a test reminder": today's numbers, now, whatever the time and whether they studied. */
  async sendTestReminder(userId: string, appUrl: string, now = Date.now()): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!botConfig()) return { ok: false, error: 'The bot is not set up yet.' };
    const db = await this.database.get();
    const r = await db.query('SELECT chat_id FROM telegram_links WHERE user_id = $1', [userId]);
    if (!r.rows[0]) return { ok: false, error: 'Connect your own Telegram first: Settings → Telegram in the app.' };
    const user = await this.usersRepo.findUserById(userId);
    if (!user) return { ok: false, error: 'Profile not found.' };
    const lang = await this.langOf(userId, 'uz');
    const text = reminderText(lang, await this.numbersFor(user, lang, now), true)!;
    const res = await call('sendMessage', { chat_id: num(r.rows[0].chat_id), text, reply_markup: reminderButtons(lang, appUrl) });
    return res.ok ? { ok: true } : { ok: false, error: `Telegram said: ${res.description}` };
  }

  /** For the admin page: counts only. */
  async telegramCounts(now = Date.now()): Promise<{ linked: number; remindersOn: number; sentToday: number }> {
    const db = await this.database.get();
    const r = await db.query(
      `SELECT count(*)::int AS linked, count(*) FILTER (WHERE reminders)::int AS on,
              count(*) FILTER (WHERE last_sent_day = $1)::int AS today FROM telegram_links`,
      [todayKey(now)],
    );
    return { linked: num(r.rows[0]?.linked), remindersOn: num(r.rows[0]?.on), sentToday: num(r.rows[0]?.today) };
  }
}
