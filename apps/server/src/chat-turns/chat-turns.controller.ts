import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { chatStreamEventsQuerySchema } from '@repo/types/api/chat-stream';
import {
  chatTurnEnqueueRequestSchema,
  chatTurnEnqueueResponseSchema,
  CHAT_TURN_ID_PATTERN,
  type ChatTurnEnqueueResponse,
} from '@repo/types/api/chat-turn';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import type { ChatTurnEnqueueResult } from './chat-turn-enqueue.service';
import { ChatTurnEnqueueService } from './chat-turn-enqueue.service';
import { ChatTurnsQueryService } from './chat-turns.query.service';

@Controller('chat-turns')
@UseGuards(JwtAuthGuard)
@ApiTags('Chat Turns')
@ApiBearerAuth('access-token')
export class ChatTurnsController {
  constructor(
    private readonly service: ChatTurnsQueryService,
    private readonly enqueueService: ChatTurnEnqueueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '排队一个 Chat turn',
    description:
      '只写入 owner-bound ChatTurn、BackgroundJob 和 chat.response.requested Outbox 事实；不会在请求内调用模型或返回完成结果。',
  })
  @ApiBody({
    description:
      '请求必须引用当前用户已持久化的会话消息；字段约束以 @repo/types 的 chatTurnEnqueueRequestSchema 为准。',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'conversationId',
        'clientRequestId',
        'inputHash',
        'inputMessageIds',
        'budgetPolicyVersion',
      ],
      properties: {
        conversationId: {
          type: 'string',
          minLength: 1,
          maxLength: 128,
          pattern: CHAT_TURN_ID_PATTERN,
        },
        clientRequestId: { type: 'string', minLength: 1, maxLength: 120 },
        inputHash: {
          type: 'string',
          pattern: '^sha256:[0-9a-f]{64}$',
        },
        inputMessageIds: {
          type: 'array',
          minItems: 1,
          maxItems: 1000,
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
            pattern: CHAT_TURN_ID_PATTERN,
          },
        },
        budgetPolicyVersion: { type: 'string', minLength: 1, maxLength: 80 },
      },
      example: {
        conversationId: 'conversation_safe_id',
        clientRequestId: 'request_safe_id',
        inputHash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        inputMessageIds: ['message_safe_id'],
        budgetPolicyVersion: 'chat-budget-v1',
      },
    },
  })
  @ApiAcceptedResponse({
    description:
      '排队结果会包在全局 response envelope 中返回：{ success: true, data, requestId }。202 只表示 durable admission，不表示回答完成。',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['success', 'data', 'requestId'],
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'turn', 'backgroundJob'],
          properties: {
            kind: { type: 'string', enum: ['created', 'existing'] },
            turn: {
              type: 'object',
              additionalProperties: false,
              required: [
                'id',
                'conversationId',
                'status',
                'createdAt',
                'updatedAt',
              ],
              properties: {
                id: { type: 'string', pattern: CHAT_TURN_ID_PATTERN },
                conversationId: {
                  type: 'string',
                  pattern: CHAT_TURN_ID_PATTERN,
                },
                status: {
                  type: 'string',
                  enum: [
                    'QUEUED',
                    'ACTIVE',
                    'SUCCEEDED',
                    'FAILED',
                    'CANCELLED',
                  ],
                },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            backgroundJob: {
              type: 'object',
              additionalProperties: false,
              required: [
                'id',
                'status',
                'attempt',
                'maxAttempts',
                'progress',
                'requestedAt',
              ],
              properties: {
                id: { type: 'string', pattern: CHAT_TURN_ID_PATTERN },
                status: {
                  type: 'string',
                  enum: [
                    'QUEUED',
                    'ACTIVE',
                    'SUCCEEDED',
                    'FAILED',
                    'CANCELLED',
                    'STALE_SKIPPED',
                  ],
                },
                attempt: { type: 'integer', minimum: 0 },
                maxAttempts: { type: 'integer', minimum: 1 },
                progress: { type: 'integer', minimum: 0, maximum: 100 },
                requestedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        requestId: { type: 'string', example: 'request-safe-id' },
      },
      example: {
        success: true,
        data: {
          kind: 'created',
          turn: {
            id: 'turn_safe_id',
            conversationId: 'conversation_safe_id',
            status: 'QUEUED',
            createdAt: '2026-09-04T00:00:00.000Z',
            updatedAt: '2026-09-04T00:00:00.000Z',
          },
          backgroundJob: {
            id: 'job_safe_id',
            status: 'QUEUED',
            attempt: 0,
            maxAttempts: 3,
            progress: 0,
            requestedAt: '2026-09-04T00:00:00.000Z',
          },
        },
        requestId: 'request-safe-id',
      },
    },
  })
  enqueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<ChatTurnEnqueueResponse> {
    const input = chatTurnEnqueueRequestSchema.parse(body);
    return this.enqueueService
      .enqueue({ userId: user.id, ...input })
      .then(toEnqueueResponse);
  }

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

function toEnqueueResponse(
  result: ChatTurnEnqueueResult,
): ChatTurnEnqueueResponse {
  return chatTurnEnqueueResponseSchema.parse({
    kind: result.kind,
    turn: {
      id: result.turn.id,
      conversationId: result.turn.conversationId,
      status: result.turn.status,
      createdAt: result.turn.createdAt.toISOString(),
      updatedAt: result.turn.updatedAt.toISOString(),
    },
    backgroundJob: {
      id: result.backgroundJob.id,
      status: result.backgroundJob.status,
      attempt: result.backgroundJob.attempt,
      maxAttempts: result.backgroundJob.maxAttempts,
      progress: result.backgroundJob.progress,
      requestedAt: result.backgroundJob.requestedAt.toISOString(),
    },
  });
}
