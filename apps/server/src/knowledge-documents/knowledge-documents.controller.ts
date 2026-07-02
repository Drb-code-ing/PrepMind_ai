import {
  CallHandler,
  Body,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  mixin,
  type NestInterceptor,
  type Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import {
  knowledgeDocumentListQuerySchema,
  knowledgeDocumentProcessRequestSchema,
} from '@repo/types/api/knowledge';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { ServerEnv } from '../config/env';
import { DocumentProcessingJobService } from './jobs/document-processing-job.service';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

@Controller('knowledge/documents')
@UseGuards(JwtAuthGuard)
@ApiTags('Knowledge Documents')
@ApiBearerAuth('access-token')
export class KnowledgeDocumentsController {
  constructor(
    private readonly knowledgeDocumentsService: KnowledgeDocumentsService,
    private readonly documentProcessingJobService: DocumentProcessingJobService,
  ) {}

  @Post()
  @UseInterceptors(createKnowledgeDocumentFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '上传知识库资料',
    description:
      '上传 PDF、DOCX、Markdown 或 TXT 文件，创建 Document 元数据；解析、分块和 embedding 可后续手动触发或进入队列。',
  })
  @ApiBody({
    description: '资料文件上传表单。字段名固定为 file。',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF、DOCX、Markdown 或 TXT 文件。',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      '上传后的资料元数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.knowledgeDocumentsService.createUploadDocument(user.id, file);
  }

  @Put(':id/file')
  @UseInterceptors(createKnowledgeDocumentFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '替换知识库资料文件',
    description:
      '在保留 Document.id 的前提下替换文件，并把资料状态重置为 PENDING；PROCESSING 中的资料不会被替换。',
  })
  @ApiBody({
    description: '资料文件替换表单。字段名固定为 file。',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '新的 PDF、DOCX、Markdown 或 TXT 文件。',
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      '替换后的资料元数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  replaceFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.knowledgeDocumentsService.replaceUploadDocument(
      user.id,
      id,
      file,
    );
  }

  @Get()
  @ApiOperation({
    summary: '列出当前用户资料',
    description: '按当前用户隔离返回知识库资料列表，可用状态、来源类型、分页参数做筛选。',
  })
  @ApiOkResponse({
    description:
      '资料列表会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = knowledgeDocumentListQuerySchema.parse(query);
    return this.knowledgeDocumentsService.list(user.id, input);
  }

  @Post(':id/process')
  @ApiOperation({
    summary: '处理或入队处理资料',
    description:
      '触发资料解析、段落感知分块、SafetyGuard 标记、embedding 和 chunk 写入；队列模式下返回后台任务元数据。',
  })
  @ApiBody({
    description:
      '处理选项。force=true 会在同一处理快照下重建 chunks，适合修复失败或更新解析逻辑后的重跑。',
    required: false,
    schema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          default: false,
          example: false,
        },
      },
      example: {
        force: false,
      },
    },
  })
  @ApiCreatedResponse({
    description:
      '处理结果或后台任务元数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  process(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = knowledgeDocumentProcessRequestSchema.parse(body ?? {});
    return this.documentProcessingJobService.enqueueOrRun(user.id, id, input);
  }

  @Get(':id')
  @ApiOperation({
    summary: '读取单份资料详情',
    description: '返回当前用户拥有的一份资料及其处理状态、chunk 数和错误摘要。',
  })
  @ApiOkResponse({
    description:
      '资料详情会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.knowledgeDocumentsService.getById(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除知识库资料',
    description: '删除当前用户拥有的资料卡片、关联 chunks 和对象存储文件。',
  })
  @ApiOkResponse({
    description:
      '删除结果会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.knowledgeDocumentsService.delete(user.id, id);
  }
}

function createKnowledgeDocumentFileInterceptor(): Type<NestInterceptor> {
  class KnowledgeDocumentFileInterceptor implements NestInterceptor {
    private readonly delegate: NestInterceptor;

    constructor(
      @Inject(ConfigService)
      private readonly configService: ConfigService<ServerEnv, true>,
    ) {
      const maxDocumentBytes = this.configService.get(
        'UPLOAD_DOCUMENT_MAX_BYTES',
        {
          infer: true,
        },
      );
      const Interceptor = FileInterceptor('file', {
        limits: {
          fileSize: maxDocumentBytes,
        },
      });
      this.delegate = new Interceptor();
    }

    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> | Promise<Observable<unknown>> {
      return this.delegate.intercept(context, next);
    }
  }

  return mixin(KnowledgeDocumentFileInterceptor);
}
