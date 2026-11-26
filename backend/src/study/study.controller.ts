import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { isReason } from '@/lib/study/types';
import { checkMessage } from '@/lib/study/text';
import { signupWeek } from '@/lib/study/week';
import { DAY, HOUR, MIN } from '@/lib/time';
import { CurrentUser } from '@api/auth/auth.decorators';
import { TIMEZONE } from '@api/common/db-util';
import { fail, tooMany } from '@api/common/http-errors';
import { RateLimiter } from '@api/common/rate-limit.service';
import type { UserRow } from '@api/users/users.repository';
import { canStudy, cleanSlots, StudyService } from './study.service';

/** The same answer for a group you're not in, so nobody can tell whether a group exists. */
const noGroup = () => fail(404, 'That group doesn’t exist.');

/** Study together: weekly groups matched by free hours, their chat, and speaking clubs. */
@Controller('study')
export class StudyController {
  constructor(private readonly study: StudyService, private readonly limiter: RateLimiter) {}

  /** Your week: sign-up, group, tasks and the speaking clubs coming up. */
  @Get()
  async state(@CurrentUser() user: UserRow) {
    await this.study.ensureMatched(user.courseId);
    return this.study.studyState(user);
  }

  /** Say when you're free this week. */
  @Put('signup')
  async signup(@CurrentUser() user: UserRow, @Body() body: { slots?: unknown } | undefined) {
    if (!canStudy(user)) throw fail(403, 'Study groups are for the students of this course.');
    if (!(await this.limiter.hit(`study-signup:${user.id}`, 60, HOUR))) throw tooMany('Too many changes. Try again later.');
    const slots = cleanSlots(body?.slots);
    if (!slots) throw new BadRequestException('Send { slots }.');
    if (!slots.length) throw new BadRequestException('Pick at least one hour when you’re free.');
    await this.study.saveSignup(user.id, user.courseId, signupWeek(Date.now(), TIMEZONE), slots);
    return this.study.studyState(user);
  }

  @Delete('signup')
  async withdraw(@CurrentUser() user: UserRow) {
    await this.study.removeSignup(user.id, user.courseId, signupWeek(Date.now(), TIMEZONE));
    return this.study.studyState(user);
  }

  @Get('groups/:id/messages')
  async messages(@CurrentUser() user: UserRow, @Param('id') id: string, @Query('after') afterRaw?: string) {
    const after = Number(afterRaw ?? 0);
    const messages = await this.study.listMessages(id, user.id, Number.isSafeInteger(after) && after > 0 ? after : 0);
    if (!messages) throw noGroup();
    return { messages };
  }

  @Post('groups/:id/messages') @HttpCode(200)
  async send(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: { body?: unknown } | undefined) {
    const group = await this.study.memberGroup(id, user.id);
    if (!group) throw noGroup();
    if (!group.open) throw fail(409, 'This group’s week is over, so its chat is read-only.');
    if (!(await this.limiter.hit(`study-msg:${user.id}`, 20, MIN)) || !(await this.limiter.hit(`study-msg-day:${user.id}`, 300, DAY))) {
      throw tooMany('You’re sending messages very fast. Wait a moment.');
    }
    const check = checkMessage(body?.body);
    if (!check.ok) throw new BadRequestException(check.error);
    const message = await this.study.addMessage(id, user.id, check.body);
    if (!message) throw noGroup();
    return { message };
  }

  @Post('groups/:id/block') @HttpCode(200)
  async block(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: { member?: unknown } | undefined) {
    if (typeof body?.member !== 'string' || !body.member) throw new BadRequestException('Send { member }.');
    if (!(await this.study.blockMember(id, user.id, body.member))) throw noGroup();
  }

  @Post('groups/:id/leave') @HttpCode(200)
  async leave(@CurrentUser() user: UserRow, @Param('id') id: string) {
    if (!(await this.study.leaveGroup(id, user.id))) throw noGroup();
  }

  @Post('groups/:id/report') @HttpCode(200)
  async report(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: { member?: unknown; reason?: unknown } | undefined) {
    if (typeof body?.member !== 'string' || !isReason(body.reason)) throw new BadRequestException('Send { member, reason }.');
    if (!(await this.limiter.hit(`study-report:${user.id}`, 10, DAY))) throw tooMany('Too many reports today. Talk to your teacher.');
    if (!(await this.study.reportMember(id, user.id, body.member, body.reason))) throw noGroup();
  }

  @Post('clubs/:id/rsvp') @HttpCode(200)
  async rsvp(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: { going?: unknown } | undefined) {
    const going = body?.going === true;
    if (!user.member || !(await this.study.rsvpClub(id, user.id, user.courseId, going))) throw fail(404, 'That speaking club doesn’t exist any more.');
    return { clubs: await this.study.upcomingClubs(user.courseId, user.id) };
  }
}
