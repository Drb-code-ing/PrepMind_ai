import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type {
  KnowledgeDocumentMimeType,
  KnowledgeDocumentType,
} from '@repo/types/api/knowledge';
import type {
  UploadImageMimeType,
  UploadImagePurpose,
} from '@repo/types/api/upload';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';

type MinioClientLike = Pick<
  MinioClient,
  | 'bucketExists'
  | 'makeBucket'
  | 'putObject'
  | 'statObject'
  | 'getObject'
  | 'removeObject'
  | 'listObjectsV2'
>;

type UploadImageInput = {
  file: Express.Multer.File | undefined;
  purpose: UploadImagePurpose;
  groupId?: string;
};

type UploadKnowledgeDocumentInput = {
  file: Express.Multer.File | undefined;
};

const mimeExtensions: Record<UploadImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const documentMimeTypes: Record<
  KnowledgeDocumentMimeType,
  { extension: string; type: KnowledgeDocumentType }
> = {
  'application/pdf': { extension: 'pdf', type: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: 'docx',
    type: 'DOCX',
  },
  'text/markdown': { extension: 'md', type: 'MD' },
  'text/x-markdown': { extension: 'md', type: 'MD' },
  'text/plain': { extension: 'txt', type: 'TXT' },
};

const OPERATOR_AUDIT_EXPORT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const OPERATOR_AUDIT_EXPORT_KEY_PATTERN =
  /^operator-audit-exports\/([A-Za-z0-9_-]{1,100})\/attempts\/([A-Za-z0-9_-]{1,100})\.zip$/;

export class OperatorAuditExportStorageError extends Error {
  constructor(readonly kind: 'missing' | 'unavailable') {
    super(
      kind === 'missing'
        ? 'Operator audit export object is missing'
        : 'Operator audit export storage is unavailable',
    );
    this.name = 'OperatorAuditExportStorageError';
  }
}

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly publicApiBaseUrl: string;
  private readonly maxImageBytes: number;
  private readonly maxDocumentBytes: number;
  private readonly minioClient: MinioClientLike;
  private bucketReadyPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService<ServerEnv, true>,
    @Optional() @Inject('MINIO_CLIENT') minioClient?: MinioClientLike,
  ) {
    const endpoint = parseMinioEndpoint(
      configService.get('MINIO_ENDPOINT', { infer: true }),
      configService.get('MINIO_PORT', { infer: true }),
    );

    this.minioClient =
      minioClient ??
      new MinioClient({
        endPoint: endpoint.endPoint,
        port: endpoint.port,
        useSSL: configService.get('MINIO_USE_SSL', { infer: true }),
        accessKey: configService.get('MINIO_ACCESS_KEY', { infer: true }),
        secretKey: configService.get('MINIO_SECRET_KEY', { infer: true }),
      });
    this.bucket = this.configService.get('MINIO_BUCKET', { infer: true });
    this.publicApiBaseUrl = this.configService
      .get('PUBLIC_API_BASE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.maxImageBytes = this.configService.get('UPLOAD_IMAGE_MAX_BYTES', {
      infer: true,
    });
    this.maxDocumentBytes = this.configService.get(
      'UPLOAD_DOCUMENT_MAX_BYTES',
      {
        infer: true,
      },
    );
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

  async uploadKnowledgeDocument(
    userId: string,
    input: UploadKnowledgeDocumentInput,
  ) {
    const file = input.file;
    if (!file) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_REQUIRED',
        '请选择要上传的资料文件',
        HttpStatus.BAD_REQUEST,
      );
    }

    const documentType = this.assertSupportedDocument(file);
    if (file.size > this.maxDocumentBytes) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_TOO_LARGE',
        '资料文件大小超过限制',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    await this.ensureBucket();
    const objectKey = [
      'users',
      sanitizeSegment(userId),
      'knowledge',
      `${randomUUID()}.${documentType.extension}`,
    ].join('/');

    await this.minioClient.putObject(
      this.bucket,
      objectKey,
      file.buffer,
      file.size,
      { 'Content-Type': documentType.mimeType },
    );

    return {
      objectKey,
      mimeType: documentType.mimeType,
      type: documentType.type,
      size: file.size,
      originalName: file.originalname || 'untitled',
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    const safeKey = this.assertStorageObjectKey(objectKey);
    await this.minioClient.removeObject(this.bucket, safeKey);
  }

  async readObject(objectKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const safeKey = this.assertReadableObjectKey(objectKey);
    try {
      return await this.readStoredObject(safeKey);
    } catch {
      throw new AppError(
        'UPLOAD_IMAGE_NOT_FOUND',
        '图片不存在',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async readKnowledgeDocumentObject(objectKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const safeKey = this.assertKnowledgeDocumentObjectKey(objectKey);
    try {
      return await this.readStoredObject(safeKey);
    } catch {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_READ_FAILED',
        '无法读取资料文件',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async writeOperatorAuditExport(
    exportId: string,
    processingToken: string,
    filePath: string,
  ): Promise<string> {
    const safeExportId = assertOperatorAuditExportSegment(exportId);
    const safeToken = assertOperatorAuditExportSegment(processingToken);
    const objectKey = createOperatorAuditExportObjectKey(
      safeExportId,
      safeToken,
    );

    try {
      await this.ensureBucket();
      const file = await stat(filePath);
      if (!file.isFile()) throw new Error('Audit export archive is not a file');
      const stream = createReadStream(filePath);
      try {
        await this.minioClient.putObject(
          this.bucket,
          objectKey,
          stream,
          file.size,
          { 'Content-Type': 'application/zip' },
        );
      } finally {
        stream.destroy();
      }
      return objectKey;
    } catch (error) {
      if (error instanceof OperatorAuditExportStorageError) throw error;
      throw new OperatorAuditExportStorageError('unavailable');
    }
  }

  async readOperatorAuditExport(objectKey: string): Promise<{
    stream: Readable;
    contentType: 'application/zip';
  }> {
    const safeKey = assertOperatorAuditExportKey(objectKey);
    try {
      await this.minioClient.statObject(this.bucket, safeKey);
      const stream = await this.minioClient.getObject(this.bucket, safeKey);
      return { stream, contentType: 'application/zip' };
    } catch (error) {
      throw storageErrorFor(error);
    }
  }

  async deleteOperatorAuditExport(objectKey: string): Promise<void> {
    const safeKey = assertOperatorAuditExportKey(objectKey);
    try {
      await this.minioClient.removeObject(this.bucket, safeKey);
    } catch (error) {
      if (isMissingObjectError(error)) return;
      throw new OperatorAuditExportStorageError('unavailable');
    }
  }

  async listOperatorAuditExportObjects(exportId: string): Promise<string[]> {
    const safeExportId = assertOperatorAuditExportSegment(exportId);
    const prefix = `operator-audit-exports/${safeExportId}/attempts/`;

    try {
      const objects = this.minioClient.listObjectsV2(this.bucket, prefix, true);
      const keys: string[] = [];
      await new Promise<void>((resolve, reject) => {
        objects.on('data', (entry) => {
          const key = typeof entry.name === 'string' ? entry.name : '';
          const parsed = parseOperatorAuditExportKey(key);
          if (parsed?.exportId === safeExportId) keys.push(key);
        });
        objects.once('error', reject);
        objects.once('end', resolve);
      });
      return keys;
    } catch (error) {
      if (error instanceof OperatorAuditExportStorageError) throw error;
      throw new OperatorAuditExportStorageError('unavailable');
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
    const parts = trimmed.split('/');
    const fileName = parts.at(-1) ?? '';
    const extension = fileName.split('.').at(-1)?.toLowerCase();
    if (
      parts.length !== 5 ||
      parts[0] !== 'users' ||
      !parts[1] ||
      !isReadableImagePurpose(parts[2]) ||
      !parts[3] ||
      !fileName ||
      !isReadableImageExtension(extension)
    ) {
      throw new AppError(
        'UPLOAD_IMAGE_NOT_FOUND',
        'Image not found.',
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

  private assertSupportedDocument(file: Express.Multer.File): {
    mimeType: KnowledgeDocumentMimeType;
    extension: string;
    type: KnowledgeDocumentType;
  } {
    const mimeType = this.normalizeDocumentMimeType(
      file.mimetype,
      file.originalname,
    );
    const documentType = documentMimeTypes[mimeType];
    if (!documentType) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_INVALID_TYPE',
        '仅支持 PDF、DOCX、Markdown 和 TXT 资料',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { mimeType, ...documentType };
  }

  private normalizeDocumentMimeType(
    mimeType: string,
    originalName: string | undefined,
  ): KnowledgeDocumentMimeType {
    if (mimeType in documentMimeTypes) {
      return mimeType as KnowledgeDocumentMimeType;
    }

    const lowerName = (originalName ?? '').toLowerCase();
    if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
      return 'text/markdown';
    }

    throw new AppError(
      'KNOWLEDGE_DOCUMENT_INVALID_TYPE',
      '仅支持 PDF、DOCX、Markdown 和 TXT 资料',
      HttpStatus.BAD_REQUEST,
    );
  }

  private assertStorageObjectKey(objectKey: string): string {
    const trimmed = objectKey.trim();
    if (
      !trimmed ||
      trimmed.includes('..') ||
      trimmed.includes('\\') ||
      trimmed.startsWith('/') ||
      !trimmed.startsWith('users/')
    ) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        '资料不存在',
        HttpStatus.NOT_FOUND,
      );
    }
    return trimmed;
  }

  private assertKnowledgeDocumentObjectKey(objectKey: string): string {
    const safeKey = this.assertStorageObjectKey(objectKey);
    const parts = safeKey.split('/');
    if (
      parts.length !== 4 ||
      parts[0] !== 'users' ||
      !parts[1] ||
      parts[2] !== 'knowledge' ||
      !parts[3]
    ) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        '资料不存在',
        HttpStatus.NOT_FOUND,
      );
    }
    return safeKey;
  }

  private async readStoredObject(safeKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
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

function isReadableImagePurpose(value: string | undefined) {
  return value === 'ocr' || value === 'wrong-question' || value === 'profile';
}

function isReadableImageExtension(value: string | undefined) {
  return (
    value === 'jpg' || value === 'jpeg' || value === 'png' || value === 'webp'
  );
}

function assertOperatorAuditExportSegment(value: string) {
  if (!OPERATOR_AUDIT_EXPORT_SEGMENT_PATTERN.test(value)) {
    throw new OperatorAuditExportStorageError('unavailable');
  }
  return value;
}

export function createOperatorAuditExportObjectKey(
  exportId: string,
  processingToken: string,
) {
  const safeExportId = assertOperatorAuditExportSegment(exportId);
  const safeToken = assertOperatorAuditExportSegment(processingToken);
  return `operator-audit-exports/${safeExportId}/attempts/${safeToken}.zip`;
}

function assertOperatorAuditExportKey(value: string) {
  if (!parseOperatorAuditExportKey(value)) {
    throw new OperatorAuditExportStorageError('unavailable');
  }
  return value;
}

function parseOperatorAuditExportKey(value: string) {
  const match = OPERATOR_AUDIT_EXPORT_KEY_PATTERN.exec(value);
  if (!match?.[1] || !match[2]) return null;
  return { exportId: match[1], processingToken: match[2] };
}

function storageErrorFor(error: unknown) {
  return new OperatorAuditExportStorageError(
    isMissingObjectError(error) ? 'missing' : 'unavailable',
  );
}

function isMissingObjectError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;
  const value = error as {
    code?: unknown;
    statusCode?: unknown;
    status?: unknown;
  };
  return (
    value.code === 'NoSuchKey' ||
    value.code === 'NoSuchObject' ||
    value.code === 'NotFound' ||
    value.statusCode === 404 ||
    value.status === 404
  );
}

export function parseMinioEndpoint(endpoint: string, configuredPort: number) {
  const trimmed = endpoint.trim();
  const parsed = new URL(
    /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`,
  );
  const port = parsed.port ? Number(parsed.port) : configuredPort;

  return {
    endPoint: parsed.hostname,
    port,
  };
}
