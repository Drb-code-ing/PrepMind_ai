import { Injectable } from '@nestjs/common';
import type { UpdateMeRequest } from '@repo/types/api/auth';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return this.toAuthUser(user);
  }

  async updateMe(userId: string, input: UpdateMeRequest) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl,
      },
    });

    return this.toAuthUser(user);
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
