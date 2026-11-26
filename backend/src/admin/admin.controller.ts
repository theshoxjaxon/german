import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { parsePeriod } from '@/lib/analytics';
import { isCourseId, isTargetLang, RESERVED_COURSE_IDS } from '@/lib/courses';
import type { Role } from '@/lib/types';
import { AdminOnly, CurrentUser } from '@api/auth/auth.decorators';
import { AuthRepository } from '@api/auth/auth.repository';
import { fail } from '@api/common/http-errors';
import { hashPassword, temporaryPassword } from '@api/common/password';
import { ClassroomRepository } from '@api/classroom/classroom.repository';
import { CoursesRepository } from '@api/courses/courses.repository';
import { MailService } from '@api/mail/mail.service';
import { StudyService } from '@api/study/study.service';
import { AttemptsRepository } from '@api/tests/attempts.repository';
import { testInfo, testsFor } from '@api/tests/catalog';
import { ChannelService } from '@api/telegram/channel.service';
import { RemindersService } from '@api/telegram/reminders.service';
import {
  botConfig, call as callTelegram, configuredUsername, diagnose, settingProblems, tokenConfig, type WebhookInfo,
} from '@api/telegram/telegram';
import { publicUser, UsersRepository, type UserRow } from '@api/users/users.repository';
import { AdminService } from './admin.service';

const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const bool = (v: unknown) => {
  if (typeof v !== 'boolean') throw new BadRequestException('Unknown choice.');
  return v;
};

/** The teachers' dashboard (/admin): its pages' data, and everything a teacher or admin changes there. */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersRepository,
    private readonly auth: AuthRepository,
    private readonly courses: CoursesRepository,
    private readonly classroom: ClassroomRepository,
    private readonly attempts: AttemptsRepository,
    private readonly study: StudyService,
    private readonly reminders: RemindersService,
    private readonly channel: ChannelService,
    private readonly mail: MailService,
  ) {}

  /* ---------- the pages' data (teachers; students get 403) ---------- */

  private async page<T>(user: UserRow, course: string | undefined, load: (c: Awaited<ReturnType<AdminService['context']>>) => Promise<T>) {
    const ctx = await this.admin.context(user, course);
    return { user: publicUser(ctx.user), admin: ctx.admin, course: ctx.course, courses: ctx.courses, data: await load(ctx) };
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: UserRow, @Query('course') course?: string) {
    return this.page(user, course, async (c) => ({
      stats: await this.classroom.adminStats(c.course.id, c.admin),
      telegram: c.admin ? await this.telegramStatus() : null,
    }));
  }

  @Get('analytics')
  analyticsPage(@CurrentUser() user: UserRow, @Query('course') course?: string, @Query('period') period?: string) {
    return this.page(user, course, (c) => this.classroom.analytics(parsePeriod(period), c.course.id));
  }

  @Get('study')
  studyPage(@CurrentUser() user: UserRow, @Query('course') course?: string) {
    return this.page(user, course, (c) => this.study.studyAdmin(c.course.id));
  }

  @Get('tests')
  testsPage(@CurrentUser() user: UserRow, @Query('course') course?: string) {
    return this.page(user, course, async (c) => {
      const tests = testsFor(c.course.id);
      const ids = new Set(tests.map((x) => x.id));
      const { people, attempts } = await this.attempts.courseTestResults(c.course.id);
      return { tests: tests.map(testInfo), people, attempts: attempts.filter((a) => ids.has(a.testId)) };
    });
  }

  private async telegramStatus() {
    const [counts, channel] = await Promise.all([this.reminders.telegramCounts(), this.channel.channelStatus()]);
    return { problems: settingProblems(), cron: !!process.env.CRON_SECRET, ...counts, channel: channel.channel, quizToday: channel.today };
  }

  /* ---------- people ---------- */

  /** Give someone a temporary password (they log in with it, then change it) and sign them out everywhere. */
  @AdminOnly() @Post('users/:id/password') @HttpCode(200)
  async resetPassword(@Param('id') id: string) {
    if (!(await this.users.findUserById(id))) throw fail(404, 'That profile no longer exists.');
    const password = temporaryPassword();
    await this.users.setPasswordHash(id, await hashPassword(password));
    await this.auth.deleteUserSessions(id);
    return { ok: true, password };
  }

  @AdminOnly() @Put('users/:id/role')
  async setRole(@CurrentUser() me: UserRow, @Param('id') id: string, @Body() body: { role?: Role }) {
    if (body?.role !== 'admin' && body?.role !== 'student') throw new BadRequestException('Unknown role.');
    if (id === me.id) throw new BadRequestException('You can’t change your own role.');
    if (!(await this.users.findUserById(id))) throw fail(404, 'That profile no longer exists.');
    await this.users.setRole(id, body.role);
  }

  @AdminOnly() @Delete('users/:id')
  async removeUser(@CurrentUser() me: UserRow, @Param('id') id: string) {
    if (id === me.id) throw new BadRequestException('You can’t delete your own profile here.');
    await this.users.deleteUser(id);
  }

  @AdminOnly() @Put('courses/:course/members/:user/teacher')
  async setTeacher(@Param('course') courseId: string, @Param('user') userId: string, @Body() body: { teacher?: unknown }) {
    const teacher = bool(body?.teacher);
    if (!(await this.courses.membership(courseId, userId))) throw fail(404, 'That profile no longer exists.');
    await this.courses.setCourseRole(courseId, userId, teacher ? 'teacher' : 'student');
  }

  @Put('courses/:course/members/:user/class')
  async setClass(@CurrentUser() me: UserRow, @Param('course') courseId: string, @Param('user') userId: string, @Body() body: { inClass?: unknown }) {
    await this.admin.requireTeacher(me, courseId);
    const inClass = bool(body?.inClass);
    if (!(await this.courses.membership(courseId, userId))) throw fail(404, 'That profile no longer exists.');
    await this.courses.setOnBoard(courseId, userId, inClass);
  }

  /* ---------- courses ---------- */

  @AdminOnly() @Post('courses') @HttpCode(200)
  async createCourse(@Body() input: { id?: string; name?: string; targetLang?: string; note?: string }) {
    const id = cleanText(input?.id, 30).toLowerCase();
    const name = cleanText(input?.name, 60);
    if (!name) throw new BadRequestException('Give the course a name.');
    if (!isCourseId(id)) throw new BadRequestException('The link may use a–z, 0–9 and dashes (2 to 30 characters), e.g. english-b1.');
    if (RESERVED_COURSE_IDS.has(id)) throw new BadRequestException('That link is already used by the site. Pick another one.');
    if (!isTargetLang(input?.targetLang)) throw new BadRequestException('Pick the language studied.');
    if ((await this.courses.createCourse({ id, name, targetLang: input.targetLang, note: cleanText(input?.note, 80) })) === 'taken') {
      throw fail(409, 'A course with that link already exists.');
    }
  }

  @Put('courses/:course')
  async updateCourse(@CurrentUser() me: UserRow, @Param('course') courseId: string, @Body() body: { name?: unknown; note?: unknown }) {
    await this.admin.requireTeacher(me, courseId);
    const name = cleanText(body?.name, 60);
    if (!name) throw new BadRequestException('Give the course a name.');
    await this.courses.updateCourse(courseId, { name, note: cleanText(body?.note, 80) });
  }

  /** The lesson the class is on ("Lektion 10"); an empty one clears it. */
  @Put('courses/:course/lesson')
  async setLesson(@CurrentUser() me: UserRow, @Param('course') courseId: string, @Body() body: { deck?: unknown }) {
    await this.admin.requireTeacher(me, courseId);
    const deck = body?.deck;
    if (typeof deck !== 'string' || deck.length > 100) throw new BadRequestException('Unknown lesson.');
    if (!(await this.courses.setClassLesson(courseId, deck.trim() || null))) throw new BadRequestException('No shared words in that deck.');
  }

  /* ---------- speaking clubs ---------- */

  @Post('courses/:course/clubs') @HttpCode(200)
  async createClub(@CurrentUser() me: UserRow, @Param('course') courseId: string, @Body() body: { startsAt?: unknown; place?: unknown }) {
    await this.admin.requireTeacher(me, courseId);
    const startsAt = Number(body?.startsAt);
    const now = Date.now();
    if (!Number.isFinite(startsAt) || startsAt < now - 60 * 60_000 || startsAt > now + 90 * 24 * 60 * 60_000) throw new BadRequestException('Pick a time in the next 90 days.');
    const where = cleanText(body?.place, 200);
    if (/:\/\//.test(where) && !/^https:\/\/\S+$/i.test(where)) throw new BadRequestException('A link must start with https:// (or write a room, e.g. Room 204).');
    await this.study.createClub(courseId, Math.round(startsAt), where, me.id);
  }

  @Delete('courses/:course/clubs/:club')
  async removeClub(@CurrentUser() me: UserRow, @Param('course') courseId: string, @Param('club') clubId: string) {
    await this.admin.requireTeacher(me, courseId);
    if (!(await this.study.deleteClub(courseId, clubId))) throw new NotFoundException('That club no longer exists.');
  }

  /* ---------- Telegram ---------- */

  /** Point the bot's webhook at this site and set its menu. */
  @AdminOnly() @Post('telegram/setup') @HttpCode(200)
  async telegramSetup() {
    const cfg = botConfig();
    if (!cfg) throw new BadRequestException(`Missing in the environment: ${settingProblems().join(', ')}.`);
    const me = await callTelegram<{ username?: string }>('getMe', {}, cfg);
    if (!me.ok) throw new BadRequestException(`Telegram didn’t accept the token: ${me.description}`);
    if (me.result.username?.toLowerCase() !== cfg.username.toLowerCase()) {
      throw new BadRequestException(`That token belongs to @${me.result.username}. Set TELEGRAM_BOT_USERNAME to ${me.result.username} and redeploy.`);
    }
    const url = `${this.mail.appUrl()}/api/telegram/webhook`;
    if (!url.startsWith('https://') && !process.env.TELEGRAM_API_BASE) throw new BadRequestException(`Telegram needs an https:// address, not ${url}. Set APP_URL.`);
    const hook = await callTelegram('setWebhook', { url, secret_token: cfg.secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }, cfg);
    if (!hook.ok) throw new BadRequestException(`Telegram didn’t accept the webhook: ${hook.description}`);
    await callTelegram('setMyCommands', {
      commands: [{ command: 'start', description: 'Eslatmalarni yoqish' }, { command: 'stop', description: 'Eslatmalarni toʻxtatish' }],
    }, cfg);
    return { message: `@${cfg.username} is connected. Students can now connect from Settings → Telegram.` };
  }

  @AdminOnly() @Post('telegram/test') @HttpCode(200)
  async telegramTest(@CurrentUser() me: UserRow) {
    const r = await this.reminders.sendTestReminder(me.id, this.mail.appUrl());
    if (!r.ok) throw new BadRequestException(r.error);
    return { message: 'Sent. Look in your Telegram.' };
  }

  @AdminOnly() @Post('telegram/quiz') @HttpCode(200)
  async telegramQuiz() {
    const r = await this.channel.postDailyQuiz(this.mail.appUrl());
    if (r.posted) return { message: `Posted today’s quiz: ${r.term}.` };
    if (r.reason === 'already') return { message: `Today’s quiz is already out: ${r.term}.` };
    if (r.reason === 'not-set') throw new BadRequestException('Set TELEGRAM_CHANNEL (and the bot) first.');
    if (r.reason === 'no-words') throw new BadRequestException('The German course has no nouns with der, die or das yet.');
    throw new BadRequestException(`Telegram didn’t post it (${r.error}). Is the bot an admin of the channel that may post messages?`);
  }

  /** What is set up and what is missing, line by line. */
  @AdminOnly() @Get('telegram/check')
  async telegramCheck() {
    const tc = tokenConfig();
    const [me, hook] = tc
      ? await Promise.all([callTelegram<{ username?: string }>('getMe', {}, tc), callTelegram<WebhookInfo>('getWebhookInfo', {}, tc)])
      : [null, null];
    return {
      lines: diagnose({
        problems: settingProblems(), cron: !!process.env.CRON_SECRET, username: configuredUsername(),
        me, hook, expectedUrl: `${this.mail.appUrl()}/api/telegram/webhook`, now: Date.now(),
      }),
    };
  }
}
