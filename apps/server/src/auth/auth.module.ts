import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthService, PasswordService, TokenService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, TokenService],
})
export class AuthModule {}
