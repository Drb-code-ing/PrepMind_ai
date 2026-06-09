import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { updateMeRequestSchema } from '@repo/types/api/auth';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = updateMeRequestSchema.parse(body);
    return this.usersService.updateMe(user.id, input);
  }
}
