'use client';

import { useQuery } from '@tanstack/react-query';
import type { OperatorAuditLogListQuery } from '@repo/types/api/operator-audit';

import { operatorAuditApi } from '@/lib/operator-audit-api';
import { operatorAuditQueryKeys } from '@/lib/operator-audit-query-keys';
import { useUserStore } from '@/stores/userStore';

type UseOperatorAuditLogsOptions = {
  enabled?: boolean;
};

export { operatorAuditQueryKeys };

export function useOperatorAuditLogs(
  query: Partial<OperatorAuditLogListQuery>,
  options: UseOperatorAuditLogsOptions = {},
) {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const userId = currentUser?.id;
  const isAdmin = currentUser?.role === 'ADMIN';

  return useQuery({
    queryKey: operatorAuditQueryKeys.list(userId ?? 'anonymous', query),
    queryFn: async () => {
      if (!accessToken || !userId || !isAdmin) {
        throw new Error('Missing operator audit context');
      }

      return operatorAuditApi.list(accessToken, query);
    },
    enabled:
      (options.enabled ?? true) && sessionHydrated && !!accessToken && !!userId && isAdmin,
    retry: false,
  });
}
