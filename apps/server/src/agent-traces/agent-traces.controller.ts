import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  agentTraceCreateRequestSchema,
  agentTraceListQuerySchema,
  agentTraceSummaryQuerySchema,
} from '@repo/types/api/agent-trace';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AgentTracesService } from './agent-traces.service';

@Controller('agent-traces')
@UseGuards(JwtAuthGuard)
@ApiTags('Agent Traces')
@ApiBearerAuth('access-token')
export class AgentTracesController {
  constructor(private readonly agentTracesService: AgentTracesService) {}

  @Post()
  @ApiOperation({
    summary: '记录脱敏 Agent Trace',
    description:
      '写入一次 Agent 运行观测记录，只保存 route、步骤摘要、token 估算和成本估算，不保存完整 prompt、完整回答或完整 RAG chunk。',
  })
  @ApiBody({
    description:
      'Agent Trace 写入请求。示例只展示脱敏摘要，真实链路也会在服务端截断过长字段。',
    schema: {
      type: 'object',
      required: [
        'conversationId',
        'confidence',
        'status',
        'mode',
        'modelProvider',
        'modelName',
        'inputTokenEstimate',
        'outputTokenEstimate',
        'maxOutputTokens',
        'pricingKnown',
        'costEstimate',
        'ragHitCount',
        'verifierChunkCount',
        'degraded',
        'startedAt',
        'finishedAt',
        'totalDurationMs',
        'steps',
      ],
      properties: {
        runId: {
          type: 'string',
          example: 'trace-run-001',
        },
        conversationId: {
          type: 'string',
          nullable: true,
          example: 'conversation-001',
        },
        route: {
          type: 'string',
          nullable: true,
          example: 'chat',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          example: 0.86,
        },
        status: {
          type: 'string',
          enum: ['completed', 'failed', 'degraded'],
          example: 'completed',
        },
        mode: {
          type: 'string',
          enum: ['mock', 'live'],
          example: 'mock',
        },
        modelProvider: {
          type: 'string',
          example: 'mock',
        },
        modelName: {
          type: 'string',
          example: 'mock-chat',
        },
        inputTokenEstimate: {
          type: 'integer',
          minimum: 0,
          example: 320,
        },
        outputTokenEstimate: {
          type: 'integer',
          minimum: 0,
          example: 180,
        },
        maxOutputTokens: {
          type: 'integer',
          minimum: 0,
          example: 1200,
        },
        pricingKnown: {
          type: 'boolean',
          example: true,
        },
        costEstimate: {
          type: 'number',
          minimum: 0,
          example: 0.00012,
        },
        ragHitCount: {
          type: 'integer',
          minimum: 0,
          example: 2,
        },
        verifierStatus: {
          type: 'string',
          enum: ['trusted', 'suspicious', 'conflict', 'insufficient', 'skipped'],
          example: 'trusted',
        },
        verifierChunkCount: {
          type: 'integer',
          minimum: 0,
          example: 2,
        },
        tutorIntent: {
          type: 'string',
          example: 'explain_solution',
        },
        tutorDepth: {
          type: 'string',
          example: 'step_by_step',
        },
        degraded: {
          type: 'boolean',
          example: false,
        },
        inputHash: {
          type: 'string',
          example: 'sha256:sample-input-hash',
        },
        inputPreview: {
          type: 'string',
          maxLength: 2000,
          example: '用户询问一道函数极限题的解法',
        },
        startedAt: {
          type: 'string',
          format: 'date-time',
          example: '2026-07-02T09:30:00.000Z',
        },
        finishedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: '2026-07-02T09:30:02.000Z',
        },
        totalDurationMs: {
          type: 'integer',
          nullable: true,
          minimum: 0,
          example: 2000,
        },
        steps: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'object',
            required: [
              'node',
              'status',
              'startedAt',
              'finishedAt',
              'durationMs',
              'inputSummary',
              'outputSummary',
              'errorMessage',
            ],
            properties: {
              node: {
                type: 'string',
                example: 'RouterAgent',
              },
              status: {
                type: 'string',
                enum: ['completed', 'failed', 'degraded'],
                example: 'completed',
              },
              startedAt: {
                type: 'string',
                format: 'date-time',
                example: '2026-07-02T09:30:00.000Z',
              },
              finishedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                example: '2026-07-02T09:30:00.120Z',
              },
              durationMs: {
                type: 'integer',
                nullable: true,
                minimum: 0,
                example: 120,
              },
              inputSummary: {
                type: 'string',
                maxLength: 2000,
                example: '根据用户问题选择 tutor route',
              },
              outputSummary: {
                type: 'string',
                maxLength: 2000,
                example: '命中 tutor route，置信度 0.86',
              },
              errorMessage: {
                type: 'string',
                nullable: true,
                maxLength: 2000,
                example: null,
              },
            },
          },
        },
      },
      example: {
        runId: 'trace-run-001',
        conversationId: 'conversation-001',
        route: 'chat',
        confidence: 0.86,
        status: 'completed',
        mode: 'mock',
        modelProvider: 'mock',
        modelName: 'mock-chat',
        inputTokenEstimate: 320,
        outputTokenEstimate: 180,
        maxOutputTokens: 1200,
        pricingKnown: true,
        costEstimate: 0.00012,
        ragHitCount: 2,
        verifierStatus: 'trusted',
        verifierChunkCount: 2,
        tutorIntent: 'explain_solution',
        tutorDepth: 'step_by_step',
        degraded: false,
        inputHash: 'sha256:sample-input-hash',
        inputPreview: '用户询问一道函数极限题的解法',
        startedAt: '2026-07-02T09:30:00.000Z',
        finishedAt: '2026-07-02T09:30:02.000Z',
        totalDurationMs: 2000,
        steps: [
          {
            node: 'RouterAgent',
            status: 'completed',
            startedAt: '2026-07-02T09:30:00.000Z',
            finishedAt: '2026-07-02T09:30:00.120Z',
            durationMs: 120,
            inputSummary: '根据用户问题选择 tutor route',
            outputSummary: '命中 tutor route，置信度 0.86',
            errorMessage: null,
          },
        ],
      },
    },
  })
  @ApiCreatedResponse({
    description:
      '创建后的 trace 元数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  createTrace(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.agentTracesService.createTrace(
      user.id,
      agentTraceCreateRequestSchema.parse(body),
    );
  }

  @Get()
  @ApiOperation({
    summary: '列出脱敏 Agent Trace',
    description: '按当前用户读取 trace 运行列表，可按 route、mode、status 筛选。',
  })
  @ApiOkResponse({
    description:
      'trace 列表会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  listTraces(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.listTraces(
      user.id,
      agentTraceListQuerySchema.parse(query),
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: '汇总 Agent Trace 成本估算',
    description:
      '统计最近若干天的 mock/live 次数、失败次数、token 估算和估算成本；该值不替代供应商账单。',
  })
  @ApiOkResponse({
    description:
      'trace 汇总数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.getSummary(
      user.id,
      agentTraceSummaryQuerySchema.parse(query),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: '读取单次 Agent Trace 详情',
    description: '读取一次脱敏 trace run 及其步骤摘要，用于调试 Agent 路由和成本估算。',
  })
  @ApiOkResponse({
    description:
      'trace 详情会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  getTrace(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agentTracesService.getTrace(user.id, id);
  }
}
