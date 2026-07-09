'use client';

import { useEffect, useRef } from 'react';

import { authApi } from '@/lib/auth-api';
import { useAdminSessionStore } from '@/stores/admin-session-store';

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const setSession = useAdminSessionStore((state) => state.setSession);
  const clearSession = useAdminSessionStore((state) => state.clearSession);
  const setSessionHydrated = useAdminSessionStore((state) => state.setSessionHydrated);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    authApi
      .refresh()
      .then((session) => setSession(session))
      .catch(() => clearSession())
      .finally(() => setSessionHydrated(true));
  }, [clearSession, setSession, setSessionHydrated]);

  return <>{children}</>;
}
