import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { isCourseId } from '@/lib/courses';
import { CurrentUser, OptionalUser } from '@api/auth/auth.decorators';
import { SessionService } from '@api/auth/session.service';
import { fail } from '@api/common/http-errors';
import { testsFor } from '@api/tests/catalog';
import type { UserRow } from '@api/users/users.repository';
import { CourseChoiceService } from './course-choice.service';
import { CoursesRepository } from './courses.repository';

@Controller()
export class CoursesController {
  constructor(
    private readonly courses: CoursesRepository,
    private readonly choice: CourseChoiceService,
    private readonly sessions: SessionService,
  ) {}

  /** GET /api/courses → the course picker: every course, the one you are in, and whether you are signed in. */
  @OptionalUser() @Get('courses')
  async list(@CurrentUser() user?: UserRow) {
    const [courses, chosen] = await Promise.all([this.courses.listCourses(), user ? user.courseId : this.choice.chosen()]);
    return {
      courses: courses.map((c) => ({ ...c, tests: testsFor(c.id).length })),
      current: courses.some((c) => c.id === chosen) ? chosen : null,
      signedIn: !!user,
    };
  }

  /**
   * POST /api/course { id } → pick a course. Signed in: you join it and it becomes your active
   * course. A guest: the browser remembers it (a cookie) until they sign up or log in.
   */
  @OptionalUser() @Post('course') @HttpCode(200)
  async choose(@Body() body: { id?: unknown } | undefined, @CurrentUser() user?: UserRow) {
    const id = body?.id;
    if (!isCourseId(id)) throw new BadRequestException('Send { id }.');
    if (!(await this.courses.getCourse(id))) throw fail(404, 'That course no longer exists.');
    if (user) await this.courses.joinCourse(user.id, id);
    else if (this.sessions.sameOrigin()) this.choice.choose(id);
    else throw fail(403, 'Cross-site request blocked.');
  }
}
