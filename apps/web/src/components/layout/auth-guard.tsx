'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useMe } from '@/hooks/use-auth';
import { useUserStore } from '@/stores/userStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useUserStore((s) => s.currentUser);
  const accessToken = useUserStore((s) => s.accessToken);
  const sessionHydrated = useUserStore((s) => s.sessionHydrated);
  const clearSession = useUserStore((s) => s.clearSession);
  const meQuery = useMe();

  useEffect(() => {
    if (!sessionHydrated) return;

    if (!accessToken && !currentUser) {
      router.replace('/login');
      return;
    }

    if (meQuery.isError) {
      clearSession();
      router.replace('/login');
    }
  }, [accessToken, clearSession, currentUser, meQuery.isError, router, sessionHydrated]);

  const loading = !sessionHydrated || (!!accessToken && meQuery.isLoading && !currentUser);

  if (loading || !currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {loading ? '正在恢复登录状态...' : '正在跳转...'}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
