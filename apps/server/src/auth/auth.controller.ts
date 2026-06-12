import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  loginRequestSchema,
  registerRequestSchema,
} from '@repo/types/api/auth';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { ServerEnv } from '../config/env';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

type CookieRequest = Request & {
  cookies?: Record<string, string | undefined>;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  @Post('register')
  register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
  ) {
    const input = registerRequestSchema.parse(body);

    return this.authService.register(input, response, {
      userAgent,
      ipAddress: request.ip,
    });
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
  ) {
    const input = loginRequestSchema.parse(body);

    return this.authService.login(input, response, {
      userAgent,
      ipAddress: request.ip,
    });
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.authService.refresh(this.getRefreshToken(request), response, {
      userAgent,
      ipAddress: request.ip,
    });
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logout(this.getRefreshToken(request), response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  private getRefreshToken(request: CookieRequest): string | undefined {
    const cookieName: string = this.configService.get('REFRESH_COOKIE_NAME', {
      infer: true,
    });
    const cookies: unknown = request.cookies;

    if (!cookies || typeof cookies !== 'object') {
      return undefined;
    }

    const value = (cookies as Record<string, unknown>)[cookieName];
    return typeof value === 'string' ? value : undefined;
  }
}
