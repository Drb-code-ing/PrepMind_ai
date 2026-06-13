'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, RegisterRequest, UpdateMeRequest } from '@repo/types/api/auth';

import { authApi, type FrontendAuthSession } from '@/lib/auth-api';
import { useUserStore, type CurrentUser } from '@/stores/userStore';

export const authQueryKeys = {
  me: ['auth', 'me'] as const,
};

export function useMe() {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: authQueryKeys.me,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      const user = await authApi.me(accessToken);
      useUserStore.getState().setCurrentUser(user);
      return user;
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useRefreshSession() {
  const queryClient = useQueryClient();
  const setSession = useUserStore((state) => state.setSession);
  const clearSession = useUserStore((state) => state.clearSession);

  return useMutation({
    mutationFn: () => authApi.refresh(),
    onSuccess: (session) => {
      applyAuthSession(queryClient, session);
      setSession(session);
    },
    onError: () => {
      clearSession();
      queryClient.removeQueries({ queryKey: authQueryKeys.me });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setSession = useUserStore((state) => state.setSession);

  return useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),
    onSuccess: (session) => {
      applyAuthSession(queryClient, session);
      setSession(session);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const setSession = useUserStore((state) => state.setSession);

  return useMutation({
    mutationFn: (request: RegisterRequest) => authApi.register(request),
    onSuccess: (session) => {
      applyAuthSession(queryClient, session);
      setSession(session);
    },
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);
  const setCurrentUser = useUserStore((state) => state.setCurrentUser);

  return useMutation({
    mutationFn: async (request: UpdateMeRequest) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      return authApi.updateMe(request, accessToken);
    },
    onSuccess: (user) => {
      queryClient.setQueryData<CurrentUser>(authQueryKeys.me, user);
      setCurrentUser(user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clearSession = useUserStore((state) => state.clearSession);

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearSession();
      queryClient.removeQueries({ queryKey: authQueryKeys.me });
    },
  });
}

function applyAuthSession(
  queryClient: ReturnType<typeof useQueryClient>,
  session: FrontendAuthSession,
) {
  queryClient.setQueryData<CurrentUser>(authQueryKeys.me, session.user);
}

