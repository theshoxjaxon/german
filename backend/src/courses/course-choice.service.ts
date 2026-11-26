import { Injectable } from '@nestjs/common';
import { isCourseId } from '@/lib/courses';
import { DAY } from '@/lib/time';
import { RequestContext } from '@api/common/request-context.service';
import { COURSE_COOKIE } from '@/lib/courses';
import { SessionService } from '@api/auth/session.service';
import { CoursesRepository } from './courses.repository';

/**
 * The course a guest picked (or the course a link like /c/english opened), remembered in a
 * cookie so that signing up or logging in lands them in it. Signed-in people's course is on
 * their profile instead, so the cookie is cleared once a profile has taken it over: on a shared
 * computer, the next person to log in keeps their own course.
 */
@Injectable()
export class CourseChoiceService {
  constructor(private readonly ctx: RequestContext, private readonly sessions: SessionService, private readonly courses: CoursesRepository) {}

  chosen(): string | null {
    const v = this.ctx.courseCookie;
    return isCourseId(v) ? v : null;
  }

  /** Remember a guest's course in this browser for a year. */
  choose(courseId: string): void {
    this.ctx.setCookie(COURSE_COOKIE, courseId, { maxAgeSeconds: (365 * DAY) / 1000 });
  }

  /** The course this visitor studies: a signed-in person's active course, else the one this browser picked. */
  async current(): Promise<string | null> {
    const user = await this.sessions.current();
    return user ? user.courseId : this.chosen();
  }

  /** After signing in: switch to the course this browser picked as a guest, if any, then forget it. */
  async adopt(userId: string): Promise<void> {
    const courseId = this.chosen();
    if (!courseId) return;
    await this.courses.joinCourse(userId, courseId);
    this.ctx.clearCookie(COURSE_COOKIE);
  }
}
