import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { chatStreamEventsQuerySchema } from '@repo/types/api/chat-stream';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { ChatTurnsQueryService } from './chat-turns.query.service';

@Controller('chat-turns')
@UseGuards(JwtAuthGuard)
@ApiTags('Chat Turns')
@ApiBearerAuth('access-token')
export class ChatTurnsController {
  constructor(private readonly service: ChatTurnsQueryService) {}

  @Get(':turnId/events')
  @ApiOperation({
    summary: '回放一个 Chat turn 的有界事件流',
    description:
      '按当前用户读取 Redis Stream 的短期增量事件。Redis 不可用或 cursor 过期时，客户端应改读 turn 状态和已持久化回答。',
  })
  @ApiOkResponse({
    description:
      '事件回放会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  events(
    @CurrentUser() user: AuthenticatedUser,
    @Param('turnId') turnId: string,
    @Query() query: unknown,
  ) {
    return this.service.getEvents(
      user.id,
      turnId,
      chatStreamEventsQuerySchema.parse(query),
    );
  }

  @Get(':turnId')
  @ApiOperation({
    summary: '读取 Chat turn 的耐久状态',
    description:
      '返回当前用户的 turn、后台任务和 assistant 回答快照。该接口是 Redis 回放不可用或过期时的恢复权威。',
  })
  @ApiOkResponse({
    description:
      'Chat turn 状态会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('turnId') turnId: string,
  ) {
    return this.service.getStatus(user.id, turnId);
  }
}
