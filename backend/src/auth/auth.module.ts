import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CourseChoiceService } from '@api/courses/course-choice.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, CourseChoiceService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [SessionService, CourseChoiceService],
})
export class AuthModule {}
