import {
  authResponseSchema,
  authUserSchema,
  type AuthResponse,
  type AuthUser,
  type LoginRequest,
} from '@repo/types/api/auth';

import { apiClient } from './api-client';
import type { AdminGateUser } from './admin-auth-view';

export interface AdminAuthSession {
  accessToken: string;
  user: AdminGateUser;
}

export const authApi = {
  async login(request: LoginRequest): Promise<AdminAuthSession> {
    const response = authResponseSchema.parse(
      await apiClient.post<AuthResponse>('/auth/login', request),
    );

    return mapAuthResponse(response);
  },

  async refresh(): Promise<AdminAuthSession> {
    const response = authResponseSchema.parse(await apiClient.post<AuthResponse>('/auth/refresh'));
    return mapAuthResponse(response);
  },

  async me(accessToken: string): Promise<AdminGateUser> {
    const response = authUserSchema.parse(
      await apiClient.get('/auth/me', {
        accessToken,
      }),
    );

    return mapAuthUser(response);
  },

  async logout(): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>('/auth/logout');
  },
};

function mapAuthResponse(response: AuthResponse): AdminAuthSession {
  return {
    accessToken: response.accessToken,
    user: mapAuthUser(response.user),
  };
}

function mapAuthUser(user: AuthUser): AdminGateUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
  };
}
