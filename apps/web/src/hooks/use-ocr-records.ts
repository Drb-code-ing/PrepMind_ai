'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';

import { apiClient } from '@/lib/api-client';
import type { OcrRecord } from '@/lib/db';
import {
  createOcrRecordApi,
  type OcrRecordListFilters,
} from '@/lib/ocr-record-api';
import { useUserStore } from '@/stores/userStore';

const ocrRecordApi = createOcrRecordApi(apiClient);

export const ocrRecordQueryKeys = {
  all: ['ocr-records'] as const,
  list: (filters: OcrRecordListFilters) =>
    [...ocrRecordQueryKeys.all, 'list', filters] as const,
};

export function useOcrRecords(filters: OcrRecordListFilters = {}) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: ocrRecordQueryKeys.list(filters),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return ocrRecordApi.list(accessToken, filters);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useCreateOcrRecord() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      record,
      parsedJson,
    }: {
      record: OcrRecord;
      parsedJson: OcrParsedPayload;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return ocrRecordApi.create(accessToken, record, parsedJson);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ocrRecordQueryKeys.all });
    },
  });
}

export function useDeleteOcrRecord() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      await ocrRecordApi.delete(accessToken, id);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ocrRecordQueryKeys.all });
    },
  });
}
