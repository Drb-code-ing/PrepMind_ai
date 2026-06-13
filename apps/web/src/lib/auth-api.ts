import {
  authResponseSchema,
  authUserSchema,
  updateMeRequestSchema,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
  type UpdateMeRequest,
} from '@repo/types/api/auth';

import type { CurrentUser } from '@/stores/userStore';

import { apiClient } from './api-client';
import { mapAuthUserToCurrentUser } from './auth-user-mapper';

export { mapAuthUserToCurrentUser } from './auth-user-mapper';

export interface FrontendAuthSession {
  accessToken: string;
  user: CurrentUser;
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
      await apiClient.get('/auth/me', {
        accessToken,
      }),
    );

    return mapAuthUserToCurrentUser(response);
  },

  async updateMe(request: UpdateMeRequest, accessToken: string): Promise<CurrentUser> {
    const body = updateMeRequestSchema.parse(request);
    const response = authUserSchema.parse(
      await apiClient.patch('/users/me', body, {
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
