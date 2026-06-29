'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DevAiMode, DevAiModeStatus } from '@/lib/dev-ai-mode';

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

  return useMutation({
    mutationFn: setDevAiMode,
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

async function setDevAiMode(mode: DevAiMode): Promise<DevAiModeStatus> {
  const response = await fetch('/api/dev/ai-mode', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mode }),
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
