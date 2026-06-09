import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { LoginRequest, RegisterRequest } from '@repo/types';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  async register(
    input: RegisterRequest,
    response: Response,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new AppError(
        'AUTH_EMAIL_EXISTS',
        '该邮箱已注册',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name ?? null,
      },
    });

    return this.issueSession(user, response, meta);
  }

  async login(input: LoginRequest, response: Response, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw this.invalidCredentials();
    }

    const passwordOk = await this.passwordService.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordOk) {
      throw this.invalidCredentials();
    }

    return this.issueSession(user, response, meta);
  }

  async refresh(
    refreshToken: string | undefined,
    response: Response,
    meta: RequestMeta,
  ) {
    if (!refreshToken) {
      throw new AppError(
        'AUTH_REFRESH_MISSING',
        '登录状态已失效',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.revokedAt ||
      tokenRecord.expiresAt.getTime() <= Date.now()
    ) {
      throw new AppError(
        'AUTH_REFRESH_INVALID',
        '登录状态已失效',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    return this.issueSession(tokenRecord.user, response, {
      ...meta,
      familyId: tokenRecord.familyId,
    });
  }

  async logout(
    refreshToken: string | undefined,
    response: Response,
  ): Promise<{ ok: true }> {
    if (refreshToken) {
      const tokenHash = this.tokenService.hashRefreshToken(refreshToken);

      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    }

    response.clearCookie(this.getRefreshCookieName(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction(),
      path: '/',
    });

    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return this.toAuthUser(user);
  }

  private async issueSession(
    user: AuthUserRecord,
    response: Response,
    meta: RequestMeta,
  ) {
    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refresh = this.tokenService.createRefreshToken();
    const refreshExpiresAt = this.tokenService.getRefreshExpiresAt();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.tokenHash,
        familyId: meta.familyId ?? refresh.familyId,
        expiresAt: refreshExpiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    response.cookie(this.getRefreshCookieName(), refresh.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction(),
      path: '/',
      expires: refreshExpiresAt,
    });

    return {
      user: this.toAuthUser(user),
      accessToken,
    };
  }

  private toAuthUser(user: AuthUserRecord) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private invalidCredentials(): AppError {
    return new AppError(
      'AUTH_INVALID_CREDENTIALS',
      '邮箱或密码错误',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private getRefreshCookieName(): string {
    return this.configService.get('REFRESH_COOKIE_NAME', { infer: true });
  }

  private isProduction(): boolean {
    return this.configService.get('NODE_ENV', { infer: true }) === 'production';
  }
}

type AuthUserRecord = {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: 'STUDENT' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
};

export type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
  familyId?: string;
};
