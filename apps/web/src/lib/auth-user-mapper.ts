import type { AuthUser } from '@repo/types/api/auth';

import type { CurrentUser } from '@/stores/userStore';

export function mapAuthUserToCurrentUser(user: AuthUser): CurrentUser {
  return {
    id: user.id,
    username: user.name?.trim() || user.email.split('@')[0] || '用户',
    email: user.email,
    phone: user.phone ?? undefined,
  };
}

