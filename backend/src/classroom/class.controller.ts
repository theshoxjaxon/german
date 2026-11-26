import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@api/auth/auth.decorators';
import type { UserRow } from '@api/users/users.repository';
import { ClassroomRepository } from './classroom.repository';

@Controller('class')
export class ClassController {
  constructor(private readonly classroom: ClassroomRepository) {}

  /** Your class: the leaderboard, who studied today and the class's streak. */
  @Get()
  overview(@CurrentUser() user: UserRow) {
    return this.classroom.classOverview(user.id, user.courseId);
  }
}
