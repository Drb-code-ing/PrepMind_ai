import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import { parseRedisUrl } from './redis-url';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ServerEnv, true>) => ({
        connection: parseRedisUrl(
          configService.get('REDIS_URL', { infer: true }),
        ),
        prefix: configService.get('BULLMQ_PREFIX', { infer: true }),
      }),
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
