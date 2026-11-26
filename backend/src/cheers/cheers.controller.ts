import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CHEERS, isClassMember, type CheerKind } from '@/lib/types';
import { CurrentUser } from '@api/auth/auth.decorators';
import { fail } from '@api/common/http-errors';
import type { UserRow } from '@api/users/users.repository';
import { CheersRepository } from './cheers.repository';

/** A cheer is a short "keep going" to a classmate, one per classmate per day. */
@Controller('cheers')
export class CheersController {
  constructor(private readonly cheers: CheersRepository) {}

  @Post() @HttpCode(200)
  async send(@CurrentUser() user: UserRow, @Body() body: { to?: unknown; kind?: unknown } | undefined) {
    if (!isClassMember(user)) throw fail(403, 'Cheers are switched off for your profile.');
    const to = typeof body?.to === 'string' ? body.to : '';
    const kind = body?.kind as CheerKind;
    if (!to || !(kind in CHEERS)) throw new BadRequestException('Send { to, kind }.');
    const result = await this.cheers.sendCheer(user.id, to, kind, user.courseId);
    if (result === 'self') throw new BadRequestException('You can’t cheer yourself.');
    if (result === 'no-user') throw fail(404, 'That classmate no longer exists.');
    return { ok: true, already: result === 'already' };
  }

  @Post('seen') @HttpCode(200)
  async seen(@CurrentUser() user: UserRow) {
    await this.cheers.markCheersSeen(user.id);
  }
}
