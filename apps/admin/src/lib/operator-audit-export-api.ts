import {
  operatorAuditExportCreateRequestSchema,
  operatorAuditExportDetailResponseSchema,
  operatorAuditExportListResponseSchema,
  type OperatorAuditExportCreateRequest,
  type OperatorAuditExportDetailResponse,
  type OperatorAuditExportListQuery,
  type OperatorAuditExportListResponse,
} from '@repo/types/api/operator-audit-export';

import { apiClient, type ApiDownloadResult } from './api-client.ts';

interface OperatorAuditExportClient {
  get(path: string, options?: { accessToken?: string | null }): Promise<unknown>;
  post(path: string, body?: unknown, options?: { accessToken?: string | null }): Promise<unknown>;
  download(path: string, options?: { accessToken?: string | null }): Promise<ApiDownloadResult>;
}

export function createOperatorAuditExportApi(client: OperatorAuditExportClient) {
  return {
    async create(
      input: OperatorAuditExportCreateRequest,
      accessToken: string,
    ): Promise<OperatorAuditExportDetailResponse> {
      const request = operatorAuditExportCreateRequestSchema.parse(input);
      return operatorAuditExportDetailResponseSchema.parse(
        await client.post('/operator-audit-exports', request, { accessToken }),
      );
    },

    async list(
      query: Partial<OperatorAuditExportListQuery>,
      accessToken: string,
    ): Promise<OperatorAuditExportListResponse> {
      const params = new URLSearchParams();
      if (query.status) params.set('status', query.status);
      if (query.requestedByUserId) params.set('requestedByUserId', query.requestedByUserId);
      if (query.createdFrom) params.set('createdFrom', query.createdFrom);
      if (query.createdTo) params.set('createdTo', query.createdTo);
      params.set('limit', String(query.limit ?? 30));
      if (query.cursor) params.set('cursor', query.cursor);

      return operatorAuditExportListResponseSchema.parse(
        await client.get(`/operator-audit-exports?${params.toString()}`, { accessToken }),
      );
    },

    async detail(id: string, accessToken: string): Promise<OperatorAuditExportDetailResponse> {
      return operatorAuditExportDetailResponseSchema.parse(
        await client.get(`/operator-audit-exports/${encodeURIComponent(id)}`, { accessToken }),
      );
    },

    async download(id: string, accessToken: string): Promise<ApiDownloadResult> {
      return client.download(`/operator-audit-exports/${encodeURIComponent(id)}/download`, {
        accessToken,
      });
    },
  };
}

export const operatorAuditExportApi = createOperatorAuditExportApi(apiClient);
