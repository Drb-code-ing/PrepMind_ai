import type { Response } from 'express';
import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
  Res,
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
import { uploadImageFormSchema } from '@repo/types/api/upload';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { ServerEnv } from '../config/env';
import { StorageService } from './storage.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(createImageFileInterceptor())
  uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    const input = uploadImageFormSchema.parse(body);
    return this.storageService.uploadImage(user.id, {
      file,
      purpose: input.purpose,
      groupId: input.groupId,
    });
  }

  @Get('images/*objectKey')
  async readImage(
    @Param('objectKey') objectKeyParam: string | string[],
    @Res() response: Response,
  ) {
    const objectKey = Array.isArray(objectKeyParam)
      ? objectKeyParam.join('/')
      : objectKeyParam;
    const image = await this.storageService.readObject(objectKey);

    response.setHeader('Content-Type', image.contentType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    image.stream.pipe(response);
  }
}

function createImageFileInterceptor(): Type<NestInterceptor> {
  class ImageFileInterceptor implements NestInterceptor {
    private readonly delegate: NestInterceptor;

    constructor(
      @Inject(ConfigService)
      private readonly configService: ConfigService<ServerEnv, true>,
    ) {
      const maxImageBytes = this.configService.get('UPLOAD_IMAGE_MAX_BYTES', {
        infer: true,
      });
      this.delegate = new (FileInterceptor('file', {
        limits: {
          fileSize: maxImageBytes,
        },
      }))();
    }

    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> | Promise<Observable<unknown>> {
      return this.delegate.intercept(context, next);
    }
  }

  return mixin(ImageFileInterceptor);
}
