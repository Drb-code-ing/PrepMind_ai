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
export class KnowledgeDocumentsController {
  constructor(
    private readonly knowledgeDocumentsService: KnowledgeDocumentsService,
    private readonly documentProcessingJobService: DocumentProcessingJobService,
  ) {}

  @Post()
  @UseInterceptors(createKnowledgeDocumentFileInterceptor())
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.knowledgeDocumentsService.createUploadDocument(user.id, file);
  }

  @Put(':id/file')
  @UseInterceptors(createKnowledgeDocumentFileInterceptor())
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
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = knowledgeDocumentListQuerySchema.parse(query);
    return this.knowledgeDocumentsService.list(user.id, input);
  }

  @Post(':id/process')
  process(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = knowledgeDocumentProcessRequestSchema.parse(body ?? {});
    return this.documentProcessingJobService.enqueueOrRun(user.id, id, input);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.knowledgeDocumentsService.getById(user.id, id);
  }

  @Delete(':id')
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
