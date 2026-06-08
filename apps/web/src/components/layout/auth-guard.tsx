'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hydrateUserStoreFromStorage, useUserStore } from '@/stores/userStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useUserStore((s) => s.currentUser);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateUserStoreFromStorage();
    const timer = window.setTimeout(() => {
      setHydrated(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (hydrated && !currentUser) {
      router.replace('/login');
    }
  }, [hydrated, currentUser, router]);

  if (!hydrated || !currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">{!hydrated ? '加载中…' : '正在跳转…'}</div>
      </div>
    );
  }

  return <>{children}</>;
}
