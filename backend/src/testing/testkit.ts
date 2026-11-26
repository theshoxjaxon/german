/**
 * Boots the real providers (repositories and services) on whatever database is set with
 * `setDatabase()`, without HTTP, so tests can call them directly.
 */
import { Test } from '@nestjs/testing';
import { ClsModule } from 'nestjs-cls';
import { AuthRepository } from '@api/auth/auth.repository';
import { CardsRepository } from '@api/cards/cards.repository';
import { CheersRepository } from '@api/cheers/cheers.repository';
import { ClassroomRepository } from '@api/classroom/classroom.repository';
import { CommonModule } from '@api/common/common.module';
import { ownerFor, WordsRepository } from '@api/words/words.repository';
import { RateLimiter } from '@api/common/rate-limit.service';
import { TIMEZONE, todayKey } from '@api/common/db-util';
import { CoursesRepository } from '@api/courses/courses.repository';
import { DatabaseModule } from '@api/database/database.module';
import { GrammarRepository } from '@api/grammar/grammar.repository';
import { MailModule } from '@api/mail/mail.module';
import { RepositoriesModule } from '@api/repositories.module';
import { SharesService } from '@api/shares/shares.service';
import * as studyModule from '@api/study/study.service';
import { StudyService } from '@api/study/study.service';
import { ChannelService } from '@api/telegram/channel.service';
import * as channelModule from '@api/telegram/channel.service';
import { RemindersService } from '@api/telegram/reminders.service';
import * as remindersModule from '@api/telegram/reminders.service';
import { AttemptsRepository, attemptSummary } from '@api/tests/attempts.repository';
import { publicUser, UsersRepository } from '@api/users/users.repository';

/** One object with every method of the given instances (and the plain exports of their modules), so a test reads `repo.createUser(...)`. */
function merge<T>(instances: object[], statics: object = {}): T {
  return new Proxy({} as T & object, {
    get(_t, prop) {
      for (const i of instances) {
        const v = (i as Record<string | symbol, unknown>)[prop];
        if (typeof v === 'function') return v.bind(i);
        if (v !== undefined) return v;
      }
      return (statics as Record<string | symbol, unknown>)[prop];
    },
  });
}

/** The public members only: the classes' private fields would make an intersection of them impossible. */
type Pub<T> = { [K in keyof T]: T[K] };

const STATIC_REPO = { todayKey, TIMEZONE, publicUser, ownerFor, attemptSummary };
export type Repo = Pub<UsersRepository> & Pub<AuthRepository> & Pub<CoursesRepository> & Pub<WordsRepository> & Pub<CardsRepository> & Pub<CheersRepository> & Pub<ClassroomRepository> & Pub<AttemptsRepository> & Pub<GrammarRepository> & typeof STATIC_REPO;
export type StudyApi = Pub<StudyService> & typeof studyModule;
export type RemindersApi = Pub<RemindersService> & typeof remindersModule;
export type ChannelApi = Pub<ChannelService> & typeof channelModule;

export async function bootProviders() {
  const ref = await Test.createTestingModule({
    imports: [ClsModule.forRoot({ global: true }), DatabaseModule, CommonModule, RepositoriesModule, MailModule],
    providers: [StudyService, RemindersService, ChannelService, SharesService],
  }).compile();
  const repo = merge<Repo>([UsersRepository, AuthRepository, CoursesRepository, WordsRepository, CardsRepository, CheersRepository, ClassroomRepository, AttemptsRepository, GrammarRepository].map((c) => ref.get(c)), STATIC_REPO);
  return {
    ref,
    repo,
    study: merge<StudyApi>([ref.get(StudyService)], studyModule),
    reminders: merge<RemindersApi>([ref.get(RemindersService)], remindersModule),
    channel: merge<ChannelApi>([ref.get(ChannelService)], channelModule),
    shares: ref.get(SharesService),
    limiter: ref.get(RateLimiter),
  };
}
