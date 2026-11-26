import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { CurrentUser, Public } from '@api/auth/auth.decorators';
import { tooMany } from '@api/common/http-errors';
import { RateLimiter } from '@api/common/rate-limit.service';
import { MailService } from '@api/mail/mail.service';
import type { UserRow } from '@api/users/users.repository';
import { SharesService } from './shares.service';

const DAY = 86_400_000;

/** A shareable card (a test result or a streak) with a link anyone can open. */
@Controller('share')
export class SharesController {
  constructor(private readonly shares: SharesService, private readonly limiter: RateLimiter, private readonly mail: MailService) {}

  @Post() @HttpCode(200)
  async create(@CurrentUser() user: UserRow, @Body() body: { kind?: unknown; attemptId?: unknown } | null) {
    if (!(await this.limiter.hit(`share:${user.id}`, 30, DAY))) throw tooMany('Too many shares today. Try again tomorrow.');
    let id: string | null;
    if (body?.kind === 'test' && typeof body.attemptId === 'string') {
      id = await this.shares.shareTest(user, body.attemptId);
      if (!id) throw new NotFoundException('That attempt doesn’t exist.');
    } else if (body?.kind === 'streak') {
      id = await this.shares.shareStreak(user);
      if (!id) throw new BadRequestException('Study for a day first, then share your streak.');
    } else {
      throw new BadRequestException('Unknown request.');
    }
    return { url: `${this.mail.appUrl()}/s/${id}` };
  }

  /** GET /api/share/:id → the card behind a share link (public: that is the point of a link). */
  @Public() @Get(':id')
  async get(@Param('id') id: string) {
    const card = await this.shares.getShare(id);
    if (!card) throw new NotFoundException('That link doesn’t exist.');
    return { card };
  }
}
