import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Course } from '@/lib/courses';
import { fail } from '@api/common/http-errors';
import { CoursesRepository } from '@api/courses/courses.repository';
import type { UserRow } from '@api/users/users.repository';

/** Who is looking at /admin, and which course they see. */
export interface AdminContext {
  user: UserRow;
  admin: boolean; // runs the whole app: sees email addresses, makes teachers and courses
  course: Course; // the course shown
  courses: Course[]; // the ones this person may pick
}

@Injectable()
export class AdminService {
  constructor(private readonly courses: CoursesRepository) {}

  /** The course the dashboard shows: the one asked for if they teach it, else their own, else the first they teach. A student gets 403. */
  async context(user: UserRow, wanted?: string): Promise<AdminContext> {
    const courses = await this.courses.taughtCourses(user);
    const course = courses.find((c) => c.id === wanted) ?? courses.find((c) => c.id === user.courseId) ?? courses[0];
    if (!course) throw new ForbiddenException({ message: 'This page is for teachers.', name: user.displayName });
    return { user, admin: user.role === 'admin', course, courses };
  }

  /** Only admins (they run the whole app). */
  requireAdmin(user: UserRow): UserRow {
    if (user.role !== 'admin') throw fail(403, 'Only admins can do this. Sign in again as an admin.');
    return user;
  }

  /** Admins, or the teachers of this course. */
  async requireTeacher(user: UserRow, courseId: unknown): Promise<UserRow> {
    const ok = typeof courseId === 'string' && (user.role === 'admin' || (await this.courses.membership(courseId, user.id))?.role === 'teacher');
    if (!ok) throw fail(403, 'Only this course’s teachers can do this.');
    return user;
  }
}
