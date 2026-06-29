import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';

import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('AuthService', () => {
  const cookieMock = jest.fn();
  const clearCookieMock = jest.fn();
  const response = {
    cookie: cookieMock,
    clearCookie: clearCookieMock,
  } as unknown as Response;

  const user = {
    id: 'user_1',
    email: 'student@example.com',
    phone: null,
    passwordHash: 'hash',
    name: 'Student',
    avatarUrl: null,
    role: 'STUDENT' as const,
    createdAt: new Date('2026-06-09T00:00:00.000Z'),
    updatedAt: new Date('2026-06-09T00:00:00.000Z'),
  };

  const prisma = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function createService(): Promise<AuthService> {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string | number> = {
                JWT_SECRET: 'test-secret-that-is-long-enough',
                JWT_ACCESS_EXPIRES_IN: '15m',
                REFRESH_TOKEN_DAYS: 30,
                REFRESH_COOKIE_NAME: 'prepmind_refresh',
                NODE_ENV: 'test',
              };

              return values[key];
            }),
          },
        },
      ],
    }).compile();

    return moduleRef.get(AuthService);
  }

  it('registers a new user and writes refresh cookie', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});

    const service = await createService();
    const result = await service.register(
      {
        email: 'student@example.com',
        password: 'password123',
        name: 'Student',
      },
      response,
      { userAgent: 'jest', ipAddress: '127.0.0.1' },
    );

    expect(result.user.email).toBe('student@example.com');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(cookieMock).toHaveBeenCalledWith(
      'prepmind_refresh',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects duplicate registration', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const service = await createService();

    await expect(
      service.register(
        {
          email: 'student@example.com',
          password: 'password123',
          name: 'Student',
        },
        response,
        {},
      ),
    ).rejects.toMatchObject({ code: 'AUTH_EMAIL_EXISTS' });
  });

  it('revokes refresh token on logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const service = await createService();
    await service.logout('refresh-token', response);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(clearCookieMock).toHaveBeenCalledWith(
      'prepmind_refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('atomically claims an active refresh token before issuing a rotated session', async () => {
    const activeToken = {
      id: 'refresh_1',
      userId: user.id,
      tokenHash: 'hash',
      familyId: 'family_1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
      createdAt: new Date('2026-06-09T00:00:00.000Z'),
      user,
    };
    const tx = {
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.refreshToken.findUnique.mockResolvedValue(activeToken);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const service = await createService();
    await service.refresh('active-refresh-token', response, {
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'refresh_1',
        tokenHash: expect.any(String) as string,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date) as Date,
        lastUsedAt: expect.any(Date) as Date,
      },
    });
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });

  it('revokes the refresh token family when the active-token claim is lost', async () => {
    const activeToken = {
      id: 'refresh_1',
      userId: user.id,
      tokenHash: 'hash',
      familyId: 'family_1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
      createdAt: new Date('2026-06-09T00:00:00.000Z'),
      user,
    };
    const tx = {
      refreshToken: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.refreshToken.findUnique.mockResolvedValue(activeToken);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const service = await createService();

    await expect(
      service.refresh('active-refresh-token', response, {
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_REFRESH_REUSED' });

    expect(tx.refreshToken.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        familyId: 'family_1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date) as Date,
        lastUsedAt: expect.any(Date) as Date,
      },
    });
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(clearCookieMock).toHaveBeenCalledWith(
      'prepmind_refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('revokes the refresh token family when a rotated token is reused', async () => {
    const reusedToken = {
      id: 'refresh_1',
      userId: user.id,
      tokenHash: 'hash',
      familyId: 'family_1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date('2026-06-09T00:00:00.000Z'),
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
      createdAt: new Date('2026-06-09T00:00:00.000Z'),
      user,
    };
    prisma.refreshToken.findUnique.mockResolvedValue(reusedToken);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const service = await createService();

    await expect(
      service.refresh('stolen-old-refresh-token', response, {
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_REFRESH_REUSED' });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        familyId: 'family_1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date) as Date,
        lastUsedAt: expect.any(Date) as Date,
      },
    });
    expect(clearCookieMock).toHaveBeenCalledWith(
      'prepmind_refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
