import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ChatTurnsRepository } from './chat-turns.repository';

@Module({
  imports: [DatabaseModule],
  providers: [ChatTurnsRepository],
  exports: [ChatTurnsRepository],
})
export class ChatTurnsModule {}
