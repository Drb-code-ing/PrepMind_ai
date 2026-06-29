'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DevAiMode, DevAiModeStatus } from '@/lib/dev-ai-mode';
import { useUserStore } from '@/stores/userStore';

export const devAiModeQueryKeys = {
  status: ['dev-ai-mode', 'status'] as const,
};

const disabledStatus: DevAiModeStatus = {
  enabled: false,
  envMode: 'mock',
  activeMode: 'mock',
  requestedMode: 'mock',
  liveAllowedByEnv: false,
  message: null,
};

export function useDevAiModeStatus() {
  return useQuery({
    queryKey: devAiModeQueryKeys.status,
    queryFn: fetchDevAiModeStatus,
    retry: false,
  });
}

export function useSetDevAiMode() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (mode: DevAiMode) => {
      if (!accessToken) {
        throw new Error('需要登录后切换 AI 模式。');
      }

      return setDevAiMode(mode, accessToken);
    },
    onSuccess: (status) => {
      queryClient.setQueryData(devAiModeQueryKeys.status, status);
    },
  });
}

async function fetchDevAiModeStatus(): Promise<DevAiModeStatus> {
  const response = await fetch('/api/dev/ai-mode', {
    cache: 'no-store',
  });

  if (response.status === 404) {
    return disabledStatus;
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, 'AI 模式状态读取失败'));
  }

  return (await response.json()) as DevAiModeStatus;
}

async function setDevAiMode(
  mode: DevAiMode,
  accessToken: string,
): Promise<DevAiModeStatus> {
  const response = await fetch('/api/dev/ai-mode', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ accessToken, mode }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'AI 模式切换失败'));
  }

  return (await response.json()) as DevAiModeStatus;
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}
