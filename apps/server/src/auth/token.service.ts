import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { ServerEnv } from '../config/env';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', {
        infer: true,
      }),
    });
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: this.configService.get('JWT_SECRET', { infer: true }),
    });
  }

  createRefreshToken(): { token: string; tokenHash: string; familyId: string } {
    const token = randomBytes(48).toString('base64url');

    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      familyId: randomUUID(),
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getRefreshExpiresAt(now = new Date()): Date {
    const days = this.configService.get('REFRESH_TOKEN_DAYS', { infer: true });
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
