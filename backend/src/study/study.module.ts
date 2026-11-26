import { Global, Module } from '@nestjs/common';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

@Global()
@Module({ controllers: [StudyController], providers: [StudyService], exports: [StudyService] })
export class StudyModule {}
