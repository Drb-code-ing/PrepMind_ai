import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  generateMemoryCandidatesRequestSchema,
  memoryCandidateListQuerySchema,
  updateUserMemoryRequestSchema,
  userMemoryListQuerySchema,
} from '@repo/types/api/memory-agent';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MemoryAgentService } from './memory-agent.service';

@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class MemoryAgentController {
  constructor(private readonly memoryAgentService: MemoryAgentService) {}

  @Get('memory-agent/candidates')
  @ApiTags('Memory Agent')
  listCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    return this.memoryAgentService.listCandidates(
      user.id,
      memoryCandidateListQuerySchema.parse(query),
    );
  }

  @Post('memory-agent/candidates/generate')
  @ApiTags('Memory Agent')
  generateCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.memoryAgentService.generateCandidates(
      user.id,
      generateMemoryCandidatesRequestSchema.parse(body ?? {}),
    );
  }

  @Post('memory-agent/candidates/:id/accept')
  @ApiTags('Memory Agent')
  acceptCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.memoryAgentService.acceptCandidate(user.id, id);
  }

  @Post('memory-agent/candidates/:id/reject')
  @ApiTags('Memory Agent')
  rejectCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.memoryAgentService.rejectCandidate(user.id, id);
  }

  @Get('user-memories')
  @ApiTags('User Memories')
  listMemories(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    return this.memoryAgentService.listMemories(
      user.id,
      userMemoryListQuerySchema.parse(query),
    );
  }

  @Patch('user-memories/:id')
  @ApiTags('User Memories')
  updateMemory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.memoryAgentService.updateMemory(
      user.id,
      id,
      updateUserMemoryRequestSchema.parse(body),
    );
  }

  @Delete('user-memories/:id')
  @ApiTags('User Memories')
  deleteMemory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.memoryAgentService.deleteMemory(user.id, id);
  }
}
