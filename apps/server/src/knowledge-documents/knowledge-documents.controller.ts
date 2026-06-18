import {
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
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
import { knowledgeDocumentListQuerySchema } from '@repo/types/api/knowledge';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { ServerEnv } from '../config/env';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

@Controller('knowledge/documents')
@UseGuards(JwtAuthGuard)
export class KnowledgeDocumentsController {
  constructor(
    private readonly knowledgeDocumentsService: KnowledgeDocumentsService,
  ) {}

  @Post()
  @UseInterceptors(createKnowledgeDocumentFileInterceptor())
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.knowledgeDocumentsService.createUploadDocument(user.id, file);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = knowledgeDocumentListQuerySchema.parse(query);
    return this.knowledgeDocumentsService.list(user.id, input);
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
