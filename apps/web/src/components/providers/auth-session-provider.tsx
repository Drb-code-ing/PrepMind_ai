'use client';

import { useEffect, useRef } from 'react';

import { useRefreshSession } from '@/hooks/use-auth';
import { useMutationQueueFlush } from '@/hooks/use-mutation-queue-flush';
import { useUserStore } from '@/stores/userStore';

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useRefreshSession();
  const setSessionHydrated = useUserStore((state) => state.setSessionHydrated);
  const bootstrappedRef = useRef(false);

  useMutationQueueFlush();

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    mutate(undefined, {
      onSettled: () => {
        setSessionHydrated(true);
      },
    });
  }, [mutate, setSessionHydrated]);

  return <>{children}</>;
}
