'use client';

import { useQuery } from '@tanstack/react-query';
import type { BackgroundJobListQuery } from '@repo/types/api/background-job';

import { backgroundJobApi } from '@/lib/background-job-api';
import { useUserStore } from '@/stores/userStore';

type UseBackgroundJobListOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

export const backgroundJobQueryKeys = {
  all: ['background-jobs'] as const,
  list: (query: BackgroundJobListQuery) =>
    [...backgroundJobQueryKeys.all, 'list', normalizeBackgroundJobListQuery(query)] as const,
  detail: (id: string) => [...backgroundJobQueryKeys.all, 'detail', id] as const,
};

export function useBackgroundJobList(
  query: BackgroundJobListQuery,
  options: UseBackgroundJobListOptions = {},
) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: backgroundJobQueryKeys.list(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return backgroundJobApi.list(accessToken, query);
    },
    enabled: (options.enabled ?? true) && sessionHydrated && !!accessToken,
    retry: false,
    refetchInterval: options.refetchInterval,
  });
}

function normalizeBackgroundJobListQuery(query: BackgroundJobListQuery) {
  return {
    resourceType: query.resourceType,
    resourceId: query.resourceId,
    status: query.status,
    limit: query.limit ?? 10,
  };
}
