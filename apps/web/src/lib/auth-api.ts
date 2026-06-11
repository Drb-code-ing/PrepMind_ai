import {
  authResponseSchema,
  authUserSchema,
  type AuthResponse,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
} from '@repo/types/api/auth';

import type { CurrentUser } from '@/stores/userStore';

import { apiClient } from './api-client.ts';

export interface FrontendAuthSession {
  accessToken: string;
  user: CurrentUser;
}

export function mapAuthUserToCurrentUser(user: AuthUser): CurrentUser {
  return {
    id: user.id,
    username: user.name?.trim() || user.email.split('@')[0] || '用户',
    email: user.email,
    phone: user.phone ?? undefined,
  };
}

export const authApi = {
  async register(request: RegisterRequest): Promise<FrontendAuthSession> {
    const response = authResponseSchema.parse(
      await apiClient.post<AuthResponse>('/auth/register', request),
    );

    return mapAuthResponse(response);
  },

  async login(request: LoginRequest): Promise<FrontendAuthSession> {
    const response = authResponseSchema.parse(await apiClient.post<AuthResponse>('/auth/login', request));

    return mapAuthResponse(response);
  },

  async refresh(): Promise<FrontendAuthSession> {
    const response = authResponseSchema.parse(await apiClient.post<AuthResponse>('/auth/refresh'));

    return mapAuthResponse(response);
  },

  async me(accessToken: string): Promise<CurrentUser> {
    const response = authUserSchema.parse(
      await apiClient.get<AuthUser>('/auth/me', {
        accessToken,
      }),
    );

    return mapAuthUserToCurrentUser(response);
  },

  async logout(): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>('/auth/logout');
  },
};

function mapAuthResponse(response: AuthResponse): FrontendAuthSession {
  return {
    accessToken: response.accessToken,
    user: mapAuthUserToCurrentUser(response.user),
  };
}
