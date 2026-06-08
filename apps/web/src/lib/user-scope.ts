import type { CurrentUser } from '@/stores/userStore';

export interface UserScopedRecord {
  userId?: string;
}

export function getScopedUserId(user: Pick<CurrentUser, 'id'> | null | undefined) {
  if (!user?.id) {
    throw new Error('登录状态不存在，无法读写本地业务数据');
  }
  return user.id;
}

export function filterRecordsForUser<T extends UserScopedRecord>(
  records: T[],
  userId: string | null | undefined,
) {
  if (!userId) return [];
  return records.filter((record) => record.userId === userId);
}
