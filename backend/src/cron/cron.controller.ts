import { Controller, Get } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '@api/auth/auth.decorators';
import { notAllowed } from '@api/common/http-errors';
import { RequestContext } from '@api/common/request-context.service';
import { MailService } from '@api/mail/mail.service';
import { StudyService } from '@api/study/study.service';
import { ChannelService } from '@api/telegram/channel.service';
import { RemindersService } from '@api/telegram/reminders.service';

/** The scheduled jobs (see vercel.json). Vercel calls them with `Authorization: Bearer $CRON_SECRET`. */
@Controller('cron')
export class CronController {
  constructor(
    private readonly ctx: RequestContext,
    private readonly study: StudyService,
    private readonly reminders: RemindersService,
    private readonly channel: ChannelService,
    private readonly mail: MailService,
  ) {}

  private authorize(): void {
    const secret = process.env.CRON_SECRET;
    const given = Buffer.from(this.ctx.header('authorization') ?? '');
    const want = Buffer.from(`Bearer ${secret ?? ''}`);
    if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) throw notAllowed();
  }

  /** Sunday 18:00: make next week's study groups, and clear out old chats. */
  @Public() @Get('study')
  async weekly() {
    this.authorize();
    const now = Date.now();
    const groups = await this.study.matchDue(await this.study.coursesToMatch(now), now);
    await this.study.purgeStudy(now);
    return { groups };
  }

  /** Every day: the Telegram reminders and the der/die/das quiz for the channel. */
  @Public() @Get('daily')
  async daily() {
    this.authorize();
    const base = this.mail.appUrl();
    const failed = (e: unknown) => ({ error: (e as Error).message });
    const [reminders, quiz] = await Promise.all([this.reminders.sendDailyReminders(base).catch(failed), this.channel.postDailyQuiz(base).catch(failed)]);
    return { reminders, quiz };
  }
}
