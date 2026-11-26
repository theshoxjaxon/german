import { Global, Module } from '@nestjs/common';
import { AuthRepository } from './auth/auth.repository';
import { CardsRepository } from './cards/cards.repository';
import { CheersRepository } from './cheers/cheers.repository';
import { ClassroomRepository } from './classroom/classroom.repository';
import { CoursesRepository } from './courses/courses.repository';
import { GrammarRepository } from './grammar/grammar.repository';
import { AttemptsRepository } from './tests/attempts.repository';
import { UsersRepository } from './users/users.repository';
import { WordsRepository } from './words/words.repository';

const REPOSITORIES = [UsersRepository, AuthRepository, CoursesRepository, WordsRepository, CardsRepository, CheersRepository, ClassroomRepository, AttemptsRepository, GrammarRepository];

/** The data layer: every SQL query lives in one of these classes. Global, so any feature module can inject them. */
@Global()
@Module({ providers: REPOSITORIES, exports: REPOSITORIES })
export class RepositoriesModule {}
