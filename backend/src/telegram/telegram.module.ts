import { Global, Module } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { RemindersService } from './reminders.service';
import { TelegramController } from './telegram.controller';

@Global()
@Module({ controllers: [TelegramController], providers: [RemindersService, ChannelService], exports: [RemindersService, ChannelService] })
export class TelegramModule {}
