import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import {
  OperatorAuditExportStorageError,
  parseMinioEndpoint,
  StorageService,
} from './storage.service';

describe('StorageService', () => {
  const configValues: ServerEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'dev-secret-change-me',
    JWT_ACCESS_EXPIRES_IN: '15m',
    REFRESH_TOKEN_DAYS: 30,
    CORS_ORIGIN: 'http://localhost:3000',
    REFRESH_COOKIE_NAME: 'prepmind_refresh',
    MINIO_ENDPOINT: '127.0.0.1',
    MINIO_PORT: 9000,
    MINIO_USE_SSL: false,
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET: 'prepmind-dev',
    PUBLIC_API_BASE_URL: 'http://localhost:3001',
    UPLOAD_IMAGE_MAX_BYTES: 8 * 1024 * 1024,
    UPLOAD_DOCUMENT_MAX_BYTES: 20 * 1024 * 1024,
    RAG_EMBEDDING_PROVIDER: 'openai',
    RAG_EMBEDDING_MODEL: 'text-embedding-3-small',
    RAG_EMBEDDING_DIMENSIONS: 1536,
    RAG_EMBEDDING_BATCH_SIZE: 32,
    RAG_CHUNK_TARGET_TOKENS: 650,
    RAG_CHUNK_OVERLAP_TOKENS: 80,
    RAG_CHUNK_MAX_TOKENS: 900,
    RAG_MAX_CHUNKS_PER_DOCUMENT: 500,
    OPENAI_API_KEY: 'test-openai-key',
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) => configValues[key]),
  } as unknown as ConfigService<ServerEnv, true>;
  const minioClient = {
    bucketExists: jest.fn(),
    makeBucket: jest.fn(),
    putObject: jest.fn(),
    statObject: jest.fn(),
    getObject: jest.fn(),
    removeObject: jest.fn(),
    listObjectsV2: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    minioClient.bucketExists.mockResolvedValue(true);
    minioClient.putObject.mockResolvedValue({ etag: 'etag_1' });
  });

  function createService() {
    return new StorageService(config, minioClient);
  }

  it('uploads supported images under a user scoped object key', async () => {
    const result = await createService().uploadImage('user_1', {
      file: {
        buffer: Buffer.from('image'),
        mimetype: 'image/png',
        size: 5,
        originalname: 'paper.png',
      } as Express.Multer.File,
      purpose: 'ocr',
      groupId: 'ocr-1',
    });

    expect(result.objectKey).toMatch(
      /^users\/user_1\/ocr\/ocr-1\/[a-f0-9-]+\.png$/,
    );
    expect(result.imageUrl).toBe(
      `http://localhost:3001/uploads/images/${result.objectKey}`,
    );
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBe(5);
    expect(minioClient.putObject).toHaveBeenCalledWith(
      'prepmind-dev',
      result.objectKey,
      Buffer.from('image'),
      5,
      { 'Content-Type': 'image/png' },
    );
  });

  it('creates the bucket before the first upload when it does not exist', async () => {
    minioClient.bucketExists.mockResolvedValue(false);

    await createService().uploadImage('user_1', {
      file: {
        buffer: Buffer.from('image'),
        mimetype: 'image/jpeg',
        size: 5,
        originalname: 'paper.jpg',
      } as Express.Multer.File,
      purpose: 'ocr',
      groupId: 'ocr-1',
    });

    expect(minioClient.makeBucket).toHaveBeenCalledWith('prepmind-dev');
  });

  it('retries bucket initialization after a failed attempt', async () => {
    minioClient.bucketExists
      .mockRejectedValueOnce(new Error('minio booting'))
      .mockResolvedValueOnce(true);

    const service = createService();
    await expect(
      service.uploadImage('user_1', {
        file: {
          buffer: Buffer.from('image'),
          mimetype: 'image/png',
          size: 5,
          originalname: 'paper.png',
        } as Express.Multer.File,
        purpose: 'ocr',
        groupId: 'ocr-1',
      }),
    ).rejects.toThrow('minio booting');

    await expect(
      service.uploadImage('user_1', {
        file: {
          buffer: Buffer.from('image'),
          mimetype: 'image/png',
          size: 5,
          originalname: 'paper.png',
        } as Express.Multer.File,
        purpose: 'ocr',
        groupId: 'ocr-1',
      }),
    ).resolves.toMatchObject({ mimeType: 'image/png' });
    expect(minioClient.bucketExists).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported mime types', async () => {
    await expect(
      createService().uploadImage('user_1', {
        file: {
          buffer: Buffer.from('text'),
          mimetype: 'text/plain',
          size: 5,
          originalname: 'paper.txt',
        } as Express.Multer.File,
        purpose: 'ocr',
        groupId: 'ocr-1',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_IMAGE_INVALID_TYPE' });
  });

  it('rejects files larger than the configured limit', async () => {
    await expect(
      createService().uploadImage('user_1', {
        file: {
          buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
          mimetype: 'image/webp',
          size: 8 * 1024 * 1024 + 1,
          originalname: 'large.webp',
        } as Express.Multer.File,
        purpose: 'ocr',
        groupId: 'ocr-1',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_IMAGE_TOO_LARGE' });
  });

  it('uploads supported knowledge documents under a user scoped object key', async () => {
    const result = await createService().uploadKnowledgeDocument('user_1', {
      file: {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        size: 3,
        originalname: 'calculus.pdf',
      } as Express.Multer.File,
    });

    expect(result.objectKey).toMatch(
      /^users\/user_1\/knowledge\/[a-f0-9-]+\.pdf$/,
    );
    expect(result.mimeType).toBe('application/pdf');
    expect(result.type).toBe('PDF');
    expect(result.originalName).toBe('calculus.pdf');
    expect(minioClient.putObject).toHaveBeenCalledWith(
      'prepmind-dev',
      result.objectKey,
      Buffer.from('pdf'),
      3,
      { 'Content-Type': 'application/pdf' },
    );
  });

  it('rejects unsupported knowledge document types', async () => {
    await expect(
      createService().uploadKnowledgeDocument('user_1', {
        file: {
          buffer: Buffer.from('zip'),
          mimetype: 'application/zip',
          size: 3,
          originalname: 'archive.zip',
        } as Express.Multer.File,
      }),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_INVALID_TYPE' });
  });

  it('rejects knowledge documents larger than the configured limit', async () => {
    await expect(
      createService().uploadKnowledgeDocument('user_1', {
        file: {
          buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
          mimetype: 'application/pdf',
          size: 20 * 1024 * 1024 + 1,
          originalname: 'large.pdf',
        } as Express.Multer.File,
      }),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_TOO_LARGE' });
  });

  it('deletes an uploaded object by key', async () => {
    await createService().deleteObject('users/user_1/knowledge/doc.pdf');

    expect(minioClient.removeObject).toHaveBeenCalledWith(
      'prepmind-dev',
      'users/user_1/knowledge/doc.pdf',
    );
  });

  it('rejects unsafe object keys before reading', () => {
    expectReadObjectKeyError('../secret');
    expectReadObjectKeyError('users\\user_1\\x.png');
    expectReadObjectKeyError('documents/file.png');
  });

  it('rejects knowledge document keys from the public image read path', () => {
    expectReadObjectKeyError('users/user_1/knowledge/notes.txt');
    expect(minioClient.statObject).not.toHaveBeenCalled();
    expect(minioClient.getObject).not.toHaveBeenCalled();
  });

  it('reads a knowledge document object with document errors', async () => {
    minioClient.statObject.mockResolvedValue({
      metaData: { 'content-type': 'text/plain' },
    });
    minioClient.getObject.mockResolvedValue(Readable.from(['hello']));

    const result = await createService().readKnowledgeDocumentObject(
      'users/user_1/knowledge/notes.txt',
    );

    expect(result.contentType).toBe('text/plain');
    expect(minioClient.statObject).toHaveBeenCalledWith(
      'prepmind-dev',
      'users/user_1/knowledge/notes.txt',
    );
  });

  it('returns a knowledge document not found error for unsafe document read keys', async () => {
    await expect(
      createService().readKnowledgeDocumentObject('../secret.txt'),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND' });
  });

  it('returns a knowledge document not found error for misplaced knowledge segments', async () => {
    await expect(
      createService().readKnowledgeDocumentObject(
        'users/user_1/ocr/knowledge/foo.png',
      ),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND' });
  });

  it('returns a knowledge read failure when MinIO read fails', async () => {
    minioClient.statObject.mockRejectedValue(new Error('minio unavailable'));

    await expect(
      createService().readKnowledgeDocumentObject(
        'users/user_1/knowledge/missing.txt',
      ),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_READ_FAILED' });
  });

  it('returns a knowledge read failure when MinIO getObject fails', async () => {
    minioClient.statObject.mockResolvedValue({
      metaData: { 'content-type': 'text/plain' },
    });
    minioClient.getObject.mockRejectedValue(new Error('minio unavailable'));

    await expect(
      createService().readKnowledgeDocumentObject(
        'users/user_1/knowledge/missing.txt',
      ),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_READ_FAILED' });
  });

  it('writes an audit export stream to an attempt-fenced ZIP key', async () => {
    const directory = join(tmpdir(), `prepmind-storage-spec-${randomUUID()}`);
    const filePath = join(directory, 'evidence.zip');
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, Buffer.from('zip-bytes'));

    try {
      await expect(
        createService().writeOperatorAuditExport(
          'export_1',
          'token_1',
          filePath,
        ),
      ).resolves.toBe('operator-audit-exports/export_1/attempts/token_1.zip');
      expect(minioClient.putObject).toHaveBeenCalledWith(
        'prepmind-dev',
        'operator-audit-exports/export_1/attempts/token_1.zip',
        expect.any(Readable),
        9,
        { 'Content-Type': 'application/zip' },
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects invalid export ids, tokens, and keys before MinIO access', async () => {
    const service = createService();

    await expect(
      service.writeOperatorAuditExport('../export', 'token', 'x.zip'),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(
      service.writeOperatorAuditExport('export', 'token/other', 'x.zip'),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(
      service.readOperatorAuditExport(
        'operator-audit-exports/export/attempts/token.zip/other',
      ),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(minioClient.putObject).not.toHaveBeenCalled();
    expect(minioClient.statObject).not.toHaveBeenCalled();
  });

  it('reads audit exports with a fixed ZIP content type', async () => {
    minioClient.statObject.mockResolvedValue({ metaData: {} });
    minioClient.getObject.mockResolvedValue(Readable.from(['zip']));

    const result = await createService().readOperatorAuditExport(
      'operator-audit-exports/export_1/attempts/token_1.zip',
    );

    expect(result.contentType).toBe('application/zip');
    expect(result.stream).toBeInstanceOf(Readable);
  });

  it('maps only missing-object shapes to missing without leaking raw messages', async () => {
    minioClient.statObject.mockRejectedValueOnce({ code: 'NoSuchKey' });
    await expect(
      createService().readOperatorAuditExport(
        'operator-audit-exports/export_1/attempts/token_1.zip',
      ),
    ).rejects.toMatchObject({ kind: 'missing' });

    minioClient.statObject.mockRejectedValueOnce(
      new Error('MinIO failed with QWEN_API_KEY=secret'),
    );
    const unavailable = await createService()
      .readOperatorAuditExport(
        'operator-audit-exports/export_1/attempts/token_1.zip',
      )
      .catch((error: unknown) => error);
    expect(unavailable).toBeInstanceOf(OperatorAuditExportStorageError);
    expect(unavailable).toMatchObject({ kind: 'unavailable' });
    expect(String(unavailable)).not.toContain('secret');
  });

  it("maps MinIO 8's bodyless NotFound code to missing for reads", async () => {
    minioClient.statObject.mockRejectedValueOnce({ code: 'NotFound' });

    await expect(
      createService().readOperatorAuditExport(
        'operator-audit-exports/export_1/attempts/token_1.zip',
      ),
    ).rejects.toMatchObject({ kind: 'missing' });
  });

  it('deletes missing audit export objects idempotently', async () => {
    minioClient.removeObject.mockRejectedValueOnce({
      code: 'NoSuchObject',
    });

    await expect(
      createService().deleteOperatorAuditExport(
        'operator-audit-exports/export_1/attempts/token_1.zip',
      ),
    ).resolves.toBeUndefined();
  });

  it("deletes MinIO 8's bodyless NotFound response idempotently", async () => {
    minioClient.removeObject.mockRejectedValueOnce({ code: 'NotFound' });

    await expect(
      createService().deleteOperatorAuditExport(
        'operator-audit-exports/export_1/attempts/token_1.zip',
      ),
    ).resolves.toBeUndefined();
  });

  it('lists only strictly valid attempt keys below the requested export', async () => {
    minioClient.listObjectsV2.mockReturnValue(
      Readable.from(
        [
          {
            name: 'operator-audit-exports/export_1/attempts/token_1.zip',
          },
          {
            name: 'operator-audit-exports/export_2/attempts/token_2.zip',
          },
          {
            name: 'operator-audit-exports/export_1/attempts/bad/key.zip',
          },
          { name: undefined },
        ],
        { objectMode: true },
      ),
    );

    await expect(
      createService().listOperatorAuditExportObjects('export_1'),
    ).resolves.toEqual([
      'operator-audit-exports/export_1/attempts/token_1.zip',
    ]);
    expect(minioClient.listObjectsV2).toHaveBeenCalledWith(
      'prepmind-dev',
      'operator-audit-exports/export_1/attempts/',
      true,
    );
  });

  it('keeps export objects outside existing public read and delete surfaces', async () => {
    const exportKey = 'operator-audit-exports/export_1/attempts/token_1.zip';

    await expect(createService().readObject(exportKey)).rejects.toMatchObject({
      code: 'UPLOAD_IMAGE_NOT_FOUND',
    });
    await expect(createService().deleteObject(exportKey)).rejects.toMatchObject(
      { code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND' },
    );
    expect(minioClient.getObject).not.toHaveBeenCalled();
    expect(minioClient.removeObject).not.toHaveBeenCalled();
  });

  it('accepts endpoint values that accidentally include a port', () => {
    expect(parseMinioEndpoint('localhost:9000', 9000)).toEqual({
      endPoint: 'localhost',
      port: 9000,
    });
    expect(parseMinioEndpoint('http://127.0.0.1:19000', 9000)).toEqual({
      endPoint: '127.0.0.1',
      port: 19000,
    });
  });

  function expectReadObjectKeyError(objectKey: string) {
    try {
      createService().assertReadableObjectKey(objectKey);
      throw new Error('expected object key to be rejected');
    } catch (error) {
      expect(error).toMatchObject({ code: 'UPLOAD_IMAGE_NOT_FOUND' });
    }
  }
});
