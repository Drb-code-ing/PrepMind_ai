'use client';

import { useEffect, useRef } from 'react';

import { useRefreshSession } from '@/hooks/use-auth';
import { useUserStore } from '@/stores/userStore';

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const refreshSession = useRefreshSession();
  const setSessionHydrated = useUserStore((state) => state.setSessionHydrated);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    refreshSession.mutate(undefined, {
      onSettled: () => {
        setSessionHydrated(true);
      },
    });
  }, [refreshSession, setSessionHydrated]);

  return <>{children}</>;
}
