import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { cleanAnswers, emptyOpen, scoreAttempt } from '@/lib/tests/score';
import { HOUR } from '@/lib/time';
import { UI_LANGS, type UiLang } from '@/lib/types';
import { AiService } from '@api/ai/ai.service';
import { AiError } from '@api/ai/ai';
import { CurrentUser } from '@api/auth/auth.decorators';
import { fail, tooMany } from '@api/common/http-errors';
import { RateLimiter } from '@api/common/rate-limit.service';
import { CoursesRepository } from '@api/courses/courses.repository';
import type { UserRow } from '@api/users/users.repository';
import { AttemptsRepository } from './attempts.repository';
import { publicTest } from '@/lib/tests/score';
import { attemptDetail, findTest, testInfo, testsFor } from './catalog';

const notYours = () => fail(404, 'That test isn’t in your course.');
const noAttempt = () => fail(404, 'That attempt doesn’t exist.');

/** Mock tests of your course: take one, see the result, and have the AI score the writing and speaking parts. */
@Controller('tests')
export class TestsController {
  constructor(
    private readonly attempts: AttemptsRepository,
    private readonly courses: CoursesRepository,
    private readonly ai: AiService,
    private readonly limiter: RateLimiter,
  ) {}

  /** The tests of your course and your attempts at them. */
  @Get()
  async list(@CurrentUser() user: UserRow) {
    const tests = testsFor(user.courseId);
    const ids = new Set(tests.map((x) => x.id));
    const attempts = tests.length ? (await this.attempts.listAttempts(user.id, user.courseId)).filter((a) => ids.has(a.testId)) : [];
    return { tests: tests.map(testInfo), attempts, ai: this.ai.enabled() };
  }

  /** One of your attempts. You see your own; teachers of its course see their students'. */
  @Get('attempts/:id')
  async attempt(@CurrentUser() user: UserRow, @Param('id') id: string) {
    const attempt = await this.attempts.getAttempt(id);
    const test = attempt && findTest(attempt.testId);
    const mayRead = !!attempt && (attempt.userId === user.id || user.role === 'admin' || (await this.courses.membership(attempt.courseId, user.id))?.role === 'teacher');
    if (!attempt || !test || !mayRead) throw noAttempt();
    return { attempt: attemptDetail(attempt, test) };
  }

  /** Ask the AI to score the writing and speaking of your attempt (once; a finished attempt is returned as it is). */
  @Post('attempts/:id/feedback') @HttpCode(200)
  async feedback(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: { lang?: unknown } | undefined) {
    const attempt = await this.attempts.getAttempt(id);
    const test = attempt && findTest(attempt.testId);
    if (!attempt || !test || attempt.userId !== user.id) throw noAttempt();
    if (attempt.result.complete) return { attempt: attemptDetail(attempt, test) };
    if (!this.ai.enabled()) throw fail(503, 'The AI helper isn’t switched on for this app.');
    if (!(await this.limiter.hit(`test-feedback:${user.id}`, 8, HOUR))) throw tooMany('You’ve asked for a lot of feedback this hour. Try again later.');
    if (!(await this.attempts.claimAttemptGrading(attempt.id))) throw fail(409, 'Your writing and speaking are being checked. Open the result again in a moment.');
    const lang: UiLang = UI_LANGS.includes(body?.lang as UiLang) ? (body!.lang as UiLang) : 'en';
    try {
      const graded = await this.ai.gradeOpen(test, attempt.answers, lang);
      const result = scoreAttempt(test, attempt.answers, { ...attempt.result.open, ...graded });
      await this.attempts.updateAttemptResult(attempt.id, result, null);
      return { attempt: attemptDetail({ ...attempt, result, aiError: null }, test) };
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      await this.attempts.updateAttemptResult(attempt.id, attempt.result, e.message);
      throw fail(e.status, e.message);
    }
  }

  /** The test to take (without the answers). */
  @Get(':id')
  one(@CurrentUser() user: UserRow, @Param('id') id: string) {
    const test = findTest(id);
    if (!test || test.course !== user.courseId) throw notYours();
    return { test: publicTest(test) };
  }

  /** Hand in a test: the closed questions are scored now. */
  @Post(':id/submit') @HttpCode(200)
  async submit(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: { answers?: unknown; startedAt?: unknown } | undefined) {
    const test = findTest(id);
    if (!test || test.course !== user.courseId) throw notYours();
    if (!(await this.limiter.hit(`test-submit:${user.id}`, 30, HOUR))) throw tooMany('You’ve handed in a lot of tests this hour. Try again later.');
    const answers = cleanAnswers(test, body?.answers);
    const now = Date.now();
    const startedAt = typeof body?.startedAt === 'number' && body.startedAt > now - 6 * HOUR && body.startedAt <= now ? body.startedAt : null;
    const result = scoreAttempt(test, answers, emptyOpen(test, answers));
    const attemptId = await this.attempts.saveAttempt({ userId: user.id, courseId: user.courseId, testId: test.id, answers, result, startedAt }, now);
    const attempt = (await this.attempts.getAttempt(attemptId))!;
    return { attempt: attemptDetail(attempt, test), ai: this.ai.enabled() };
  }
}
