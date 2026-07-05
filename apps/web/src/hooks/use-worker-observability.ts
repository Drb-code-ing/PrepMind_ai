'use client';

import { useQuery } from '@tanstack/react-query';

import { workerObservabilityApi } from '@/lib/worker-observability-api';
import { useUserStore } from '@/stores/userStore';

type UseWorkerObservabilitySummaryOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

export const workerObservabilityQueryKeys = {
  all: ['worker-observability'] as const,
  summary: () => [...workerObservabilityQueryKeys.all, 'summary'] as const,
};

export function useWorkerObservabilitySummary(
  options: UseWorkerObservabilitySummaryOptions = {},
) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: workerObservabilityQueryKeys.summary(),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return workerObservabilityApi.getSummary(accessToken);
    },
    enabled: (options.enabled ?? true) && sessionHydrated && !!accessToken,
    retry: false,
    refetchInterval: options.refetchInterval,
  });
}
