import { ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import { StorageService } from './storage.service';

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

  it('rejects unsafe object keys before reading', () => {
    expectReadObjectKeyError('../secret');
    expectReadObjectKeyError('users\\user_1\\x.png');
    expectReadObjectKeyError('documents/file.png');
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
