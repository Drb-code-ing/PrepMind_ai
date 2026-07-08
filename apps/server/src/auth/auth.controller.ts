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
  ApiBody,
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
  '认证结果会包在全局 response envelope 中返回：{ success: true, data, requestId }。';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: '注册新用户',
    description:
      '创建学生账号，登录成功后返回用户信息和 access token，并通过 httpOnly cookie 建立 refresh session。',
  })
  @ApiBody({
    description:
      '注册表单。字段约束仍以 @repo/types 的 registerRequestSchema 为准。',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'student@example.com',
        },
        password: {
          type: 'string',
          minLength: 8,
          maxLength: 128,
          example: 'password123',
        },
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 50,
          example: '备考同学',
        },
      },
      example: {
        email: 'student@example.com',
        password: 'password123',
        name: '备考同学',
      },
    },
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
  @ApiOperation({
    summary: '邮箱密码登录',
    description:
      '校验账号密码，返回 access token，并轮换当前设备的 refresh session cookie。',
  })
  @ApiBody({
    description:
      '登录表单。字段约束仍以 @repo/types 的 loginRequestSchema 为准。',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'student@example.com',
        },
        password: {
          type: 'string',
          minLength: 8,
          maxLength: 128,
          example: 'password123',
        },
      },
      example: {
        email: 'student@example.com',
        password: 'password123',
      },
    },
  })
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
    summary: '刷新 access token',
    description:
      '读取 httpOnly refresh cookie，执行 rotation 与 reuse detection，然后签发新的 access token。',
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
  @ApiOperation({
    summary: '退出当前会话',
    description:
      '注销当前 refresh-token session，并清理浏览器侧 refresh cookie。',
  })
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
  @ApiOperation({
    summary: '读取当前用户资料',
    description: '根据 access token 获取当前登录用户的账号资料。',
  })
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
