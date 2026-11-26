import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { CheersModule } from './cheers/cheers.module';
import { ClassroomModule } from './classroom/classroom.module';
import { CommonModule } from './common/common.module';
import { CoursesModule } from './courses/courses.module';
import { CronModule } from './cron/cron.module';
import { DatabaseModule } from './database/database.module';
import { GrammarModule } from './grammar/grammar.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { RepositoriesModule } from './repositories.module';
import { SharesModule } from './shares/shares.module';
import { StateModule } from './state/state.module';
import { StudyModule } from './study/study.module';
import { TelegramModule } from './telegram/telegram.module';
import { TestsModule } from './tests/tests.module';
import { WordsModule } from './words/words.module';

@Module({
  imports: [
    // The current request, available to services without making them request-scoped.
    ClsModule.forRoot({ global: true, middleware: { mount: true, setup: (cls, req, res) => { cls.set('req', req); cls.set('res', res); } } }),
    DatabaseModule,
    CommonModule,
    RepositoriesModule,
    MailModule,
    AiModule,
    AuthModule,
    StudyModule,
    TelegramModule,
    // features
    HealthModule,
    StateModule,
    CoursesModule,
    WordsModule,
    CardsModule,
    CheersModule,
    ClassroomModule,
    TestsModule,
    GrammarModule,
    SharesModule,
    AdminModule,
    CronModule,
  ],
})
export class AppModule {}
