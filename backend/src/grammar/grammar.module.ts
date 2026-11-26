import { Module } from '@nestjs/common';
import { GrammarController } from './grammar.controller';

@Module({ controllers: [GrammarController] })
export class GrammarModule {}
