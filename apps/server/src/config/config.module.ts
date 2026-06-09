import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { parseEnv } from './env';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: parseEnv,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
