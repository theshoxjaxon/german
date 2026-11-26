import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { DEFAULT_COURSE, isCourseId, type Course } from '@/lib/courses';
import { VISITOR_RE } from '@/lib/text';
import { AiService } from '@api/ai/ai.service';
import { CurrentUser, OptionalUser, Public } from '@api/auth/auth.decorators';
import { RateLimiter } from '@api/common/rate-limit.service';
import { tooMany } from '@api/common/http-errors';
import { CardsRepository } from '@api/cards/cards.repository';
import { CheersRepository } from '@api/cheers/cheers.repository';
import { CourseChoiceService } from '@api/courses/course-choice.service';
import { CoursesRepository } from '@api/courses/courses.repository';
import { testsFor } from '@api/tests/catalog';
import { UsersRepository, publicUser, type UserRow } from '@api/users/users.repository';
import { WordsRepository } from '@api/words/words.repository';

/** A course as the app gets it: with how many mock tests it has (the Tests tab shows when there are any). */
const withTests = (c: Course): Course => ({ ...c, tests: testsFor(c.id).length });

@Controller()
export class StateController {
  constructor(
    private readonly users: UsersRepository,
    private readonly courses: CoursesRepository,
    private readonly words: WordsRepository,
    private readonly cards: CardsRepository,
    private readonly cheers: CheersRepository,
    private readonly choice: CourseChoiceService,
    private readonly ai: AiService,
    private readonly limiter: RateLimiter,
  ) {}

  /**
   * GET /api/state → you, your course (and the list of courses), its shared words and your own
   * words in it, your progress on them, your settings and new cheers for you.
   * Not signed in → { me: null, words, course }: guests practise the flashcards of the course
   * they picked and keep their progress in their own browser. A guest who hasn't picked a
   * course yet (when there are several) gets course: null and no words.
   */
  @OptionalUser() @Get('state')
  async state(@CurrentUser() user?: UserRow) {
    if (!user) {
      const [all, chosen] = [await this.courses.listCourses(), this.choice.chosen()];
      const courses = all.map(withTests);
      const course = courses.find((c) => c.id === chosen) ?? (courses.length === 1 ? courses[0] : null);
      const words = course ? await this.words.listWords(null, course.id) : {};
      return { me: null, words, classLesson: course?.currentLesson ?? null, course, courses };
    }
    const [words, cards, prefs, cheers, streak, courses] = await Promise.all([
      this.words.listWords(user.id, user.courseId),
      this.cards.listCards(user.id, user.courseId),
      this.cards.getPrefs(user.id),
      this.cheers.unseenCheers(user.id),
      this.cards.myStreak(user.id),
      this.courses.listCourses().then((all) => all.map(withTests)),
    ]);
    const course = courses.find((c) => c.id === user.courseId) ?? courses.find((c) => c.id === DEFAULT_COURSE) ?? courses[0];
    // Everyone signed in gets the AI helper (it has an hourly limit per person, since each use costs money).
    return { me: publicUser(user), words, cards, prefs, cheers, ai: this.ai.enabled(), streak, classLesson: course?.currentLesson ?? null, course, courses };
  }

  /** GET /api/me → who you are, as the browser may know it. */
  @Get('me')
  me(@CurrentUser() user: UserRow) {
    return { me: publicUser(user) };
  }

  /** POST /api/visit { id, tried?, course? } → count an anonymous visitor (the Visit → Try → Join funnel). */
  @Public() @Post('visit') @HttpCode(204)
  async visit(@Body() body: { id?: unknown; tried?: unknown; course?: unknown } | undefined): Promise<void> {
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!VISITOR_RE.test(id)) throw new BadRequestException('Send { id }.');
    if (!(await this.limiter.hitIp('visit', 30, 60 * 60_000))) throw tooMany('Too many requests.');
    await this.users.recordVisitor(id, body?.tried === true, isCourseId(body?.course) ? body.course : this.choice.chosen());
  }
}
