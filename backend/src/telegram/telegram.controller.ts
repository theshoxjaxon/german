import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, Post } from '@nestjs/common';
import { CurrentUser, Public } from '@api/auth/auth.decorators';
import { fail, notAllowed, tooMany } from '@api/common/http-errors';
import { RateLimiter } from '@api/common/rate-limit.service';
import { RequestContext } from '@api/common/request-context.service';
import { MailService } from '@api/mail/mail.service';
import type { UserRow } from '@api/users/users.repository';
import { RemindersService } from './reminders.service';
import { botConfig, hasSecret } from './telegram';

const HOUR = 3_600_000;

/** Telegram reminders: connect your account to the bot, switch the evening reminder on or off. */
@Controller('telegram')
export class TelegramController {
  private readonly log = new Logger('Telegram');

  constructor(
    private readonly reminders: RemindersService,
    private readonly limiter: RateLimiter,
    private readonly ctx: RequestContext,
    private readonly mail: MailService,
  ) {}

  @Get()
  state(@CurrentUser() user: UserRow) {
    return this.reminders.telegramState(user.id);
  }

  @Post() @HttpCode(200)
  async act(@CurrentUser() user: UserRow, @Body() body: { action?: unknown; reminders?: unknown } | null) {
    if (body?.action === 'link') {
      const cfg = botConfig();
      if (!cfg) throw fail(503, 'Telegram reminders aren’t set up on this server yet.');
      if (!(await this.limiter.hit(`tg-link:${user.id}`, 10, HOUR))) throw tooMany('Too many tries. Wait a little, then try again.');
      return { url: await this.reminders.createLink(user.id, cfg) };
    }
    if (typeof body?.reminders === 'boolean') {
      if (!(await this.reminders.setReminders(user.id, body.reminders))) throw new BadRequestException('Connect Telegram first.');
      return this.reminders.telegramState(user.id);
    }
    throw new BadRequestException('Unknown request.');
  }

  @Delete()
  async disconnect(@CurrentUser() user: UserRow) {
    await this.reminders.unlink(user.id);
    return this.reminders.telegramState(user.id);
  }

  /** Telegram calls this with every message the bot gets. It proves itself with the secret set when the webhook was registered. */
  @Public() @Post('webhook') @HttpCode(200)
  async webhook(@Body() update: unknown) {
    if (!hasSecret(this.ctx.header('x-telegram-bot-api-secret-token') ?? null, botConfig())) throw notAllowed();
    try {
      await this.reminders.handleUpdate(update, this.mail.appUrl());
    } catch (e) {
      this.log.error(`A Telegram update failed: ${(e as Error).message}`);
    }
    return { ok: true };
  }
}
