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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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

const AUTH_RESPONSE_ENVELOPE =
  'Auth response returned in the global response envelope: { success: true, data, requestId }.';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user and start an authenticated session',
  })
  @ApiCreatedResponse({ description: AUTH_RESPONSE_ENVELOPE })
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
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ description: AUTH_RESPONSE_ENVELOPE })
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
  @ApiOperation({
    summary: 'Rotate the refresh cookie and issue a new access token',
  })
  @ApiOkResponse({ description: AUTH_RESPONSE_ENVELOPE })
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
  @ApiOperation({ summary: 'Log out the current refresh-token session' })
  @ApiOkResponse({ description: AUTH_RESPONSE_ENVELOPE })
  logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logout(this.getRefreshToken(request), response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Read the current authenticated user profile' })
  @ApiOkResponse({ description: AUTH_RESPONSE_ENVELOPE })
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
