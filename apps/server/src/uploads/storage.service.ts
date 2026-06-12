import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type {
  UploadImageMimeType,
  UploadImagePurpose,
} from '@repo/types/api/upload';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';

type MinioClientLike = Pick<
  MinioClient,
  'bucketExists' | 'makeBucket' | 'putObject' | 'statObject' | 'getObject'
>;

type UploadImageInput = {
  file: Express.Multer.File | undefined;
  purpose: UploadImagePurpose;
  groupId?: string;
};

const mimeExtensions: Record<UploadImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly publicApiBaseUrl: string;
  private readonly maxImageBytes: number;
  private bucketReadyPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService<ServerEnv, true>,
    private readonly minioClient: MinioClientLike = new MinioClient({
      endPoint: configService.get('MINIO_ENDPOINT', { infer: true }),
      port: configService.get('MINIO_PORT', { infer: true }),
      useSSL: configService.get('MINIO_USE_SSL', { infer: true }),
      accessKey: configService.get('MINIO_ACCESS_KEY', { infer: true }),
      secretKey: configService.get('MINIO_SECRET_KEY', { infer: true }),
    }),
  ) {
    this.bucket = this.configService.get('MINIO_BUCKET', { infer: true });
    this.publicApiBaseUrl = this.configService
      .get('PUBLIC_API_BASE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.maxImageBytes = this.configService.get('UPLOAD_IMAGE_MAX_BYTES', {
      infer: true,
    });
  }

  async uploadImage(userId: string, input: UploadImageInput) {
    const file = input.file;
    if (!file) {
      throw new AppError(
        'UPLOAD_IMAGE_REQUIRED',
        '请选择要上传的图片',
        HttpStatus.BAD_REQUEST,
      );
    }

    const mimeType = this.assertSupportedMimeType(file.mimetype);
    if (file.size > this.maxImageBytes) {
      throw new AppError(
        'UPLOAD_IMAGE_TOO_LARGE',
        '图片大小超过限制',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    await this.ensureBucket();
    const objectKey = this.createObjectKey({
      userId,
      purpose: input.purpose,
      groupId: input.groupId,
      mimeType,
    });

    await this.minioClient.putObject(
      this.bucket,
      objectKey,
      file.buffer,
      file.size,
      {
        'Content-Type': mimeType,
      },
    );

    return {
      objectKey,
      imageUrl: this.toPublicImageUrl(objectKey),
      mimeType,
      size: file.size,
    };
  }

  async readObject(objectKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const safeKey = this.assertReadableObjectKey(objectKey);
    try {
      const stat = await this.minioClient.statObject(this.bucket, safeKey);
      const stream = await this.minioClient.getObject(this.bucket, safeKey);
      const metadata =
        typeof stat.metaData === 'object' && stat.metaData !== null
          ? (stat.metaData as Record<string, string | undefined>)
          : {};

      return {
        stream,
        contentType:
          metadata['content-type'] ??
          metadata['Content-Type'] ??
          'application/octet-stream',
      };
    } catch {
      throw new AppError(
        'UPLOAD_IMAGE_NOT_FOUND',
        '图片不存在',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  assertReadableObjectKey(objectKey: string): string {
    const trimmed = objectKey.trim();
    if (
      !trimmed ||
      trimmed.includes('..') ||
      trimmed.includes('\\') ||
      trimmed.startsWith('/') ||
      !trimmed.startsWith('users/')
    ) {
      throw new AppError(
        'UPLOAD_IMAGE_NOT_FOUND',
        '图片不存在',
        HttpStatus.NOT_FOUND,
      );
    }
    return trimmed;
  }

  private assertSupportedMimeType(value: string): UploadImageMimeType {
    if (
      value === 'image/jpeg' ||
      value === 'image/png' ||
      value === 'image/webp'
    ) {
      return value;
    }

    throw new AppError(
      'UPLOAD_IMAGE_INVALID_TYPE',
      '仅支持 JPG、PNG、WebP 图片',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async ensureBucket() {
    this.bucketReadyPromise ??= this.createBucketReadyPromise();

    try {
      await this.bucketReadyPromise;
    } catch (error) {
      this.bucketReadyPromise = null;
      throw error;
    }
  }

  private async createBucketReadyPromise() {
    const exists = await this.minioClient.bucketExists(this.bucket);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucket);
    }
  }

  private createObjectKey({
    userId,
    purpose,
    groupId,
    mimeType,
  }: {
    userId: string;
    purpose: UploadImagePurpose;
    groupId?: string;
    mimeType: UploadImageMimeType;
  }) {
    const safeGroupId = sanitizeSegment(groupId || 'ungrouped');

    return [
      'users',
      sanitizeSegment(userId),
      purpose,
      safeGroupId,
      `${randomUUID()}.${mimeExtensions[mimeType]}`,
    ].join('/');
  }

  private toPublicImageUrl(objectKey: string) {
    return `${this.publicApiBaseUrl}/uploads/images/${objectKey}`;
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || 'unknown';
}
