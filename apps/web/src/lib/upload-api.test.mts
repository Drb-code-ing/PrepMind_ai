import assert from 'node:assert/strict';

import { ApiClientError } from './api-client.ts';
import { createUploadApi } from './upload-api.ts';

async function run() {
  await testUploadsImageWithFormDataAndAuth();
  await testThrowsEnvelopeErrors();
}

async function testUploadsImageWithFormDataAndAuth() {
  const requests: Array<{
    input: string;
    authorization: string | null;
    bodyIsFormData: boolean;
    purpose: FormDataEntryValue | null;
    groupId: FormDataEntryValue | null;
    fileName: string | undefined;
  }> = [];

  const api = createUploadApi({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      const body = init?.body as FormData;
      const file = body.get('file') as File;
      requests.push({
        input: String(input),
        authorization: headers.get('authorization'),
        bodyIsFormData: body instanceof FormData,
        purpose: body.get('purpose'),
        groupId: body.get('groupId'),
        fileName: file.name,
      });

      return jsonResponse({
        success: true,
        data: {
          objectKey: 'users/user_1/ocr/group_1/image.png',
          imageUrl:
            'http://localhost:3001/uploads/images/users/user_1/ocr/group_1/image.png',
          mimeType: 'image/png',
          size: 8,
        },
        requestId: 'req_1',
      });
    },
  });

  const result = await api.uploadImage(
    'token_1',
    new File(['12345678'], 'paper.png', {
      type: 'image/png',
    }),
    {
      purpose: 'ocr',
      groupId: 'group_1',
    },
  );

  assert.equal(requests[0].input, 'http://localhost:3001/uploads/images');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.equal(requests[0].bodyIsFormData, true);
  assert.equal(requests[0].purpose, 'ocr');
  assert.equal(requests[0].groupId, 'group_1');
  assert.equal(requests[0].fileName, 'paper.png');
  assert.equal(result.mimeType, 'image/png');
}

async function testThrowsEnvelopeErrors() {
  const api = createUploadApi({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async () =>
      jsonResponse(
        {
          success: false,
          error: {
            code: 'UPLOAD_IMAGE_INVALID_TYPE',
            message: '仅支持 JPG、PNG、WebP 图片',
          },
          requestId: 'req_error',
        },
        400,
      ),
  });

  await assert.rejects(
    () =>
      api.uploadImage(
        'token_1',
        new File(['hello'], 'note.txt', {
          type: 'text/plain',
        }),
        {
          purpose: 'ocr',
        },
      ),
    (error) =>
      error instanceof ApiClientError &&
      error.status === 400 &&
      error.code === 'UPLOAD_IMAGE_INVALID_TYPE' &&
      error.requestId === 'req_error',
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

await run();
