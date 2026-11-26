import { Module } from '@nestjs/common';
import { CheersController } from './cheers.controller';

@Module({ controllers: [CheersController] })
export class CheersModule {}
