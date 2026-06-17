import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReviewPreferencesController } from './review-preferences.controller';
import { ReviewPreferencesService } from './review-preferences.service';

@Module({
  imports: [AuthModule],
  controllers: [ReviewPreferencesController],
  providers: [ReviewPreferencesService],
  exports: [ReviewPreferencesService],
})
export class ReviewPreferencesModule {}
