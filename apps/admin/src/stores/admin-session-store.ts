'use client';

import { create } from 'zustand';

import type { AdminGateUser } from '@/lib/admin-auth-view';

interface AdminSessionState {
  currentUser: AdminGateUser | null;
  accessToken: string | null;
  sessionHydrated: boolean;
  setSession: (session: { user: AdminGateUser; accessToken: string }) => void;
  setCurrentUser: (user: AdminGateUser | null) => void;
  setSessionHydrated: (hydrated: boolean) => void;
  clearSession: () => void;
}

export const useAdminSessionStore = create<AdminSessionState>()((set) => ({
  currentUser: null,
  accessToken: null,
  sessionHydrated: false,
  setSession: (session) =>
    set({
      currentUser: session.user,
      accessToken: session.accessToken,
      sessionHydrated: true,
    }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setSessionHydrated: (hydrated) => set({ sessionHydrated: hydrated }),
  clearSession: () => set({ currentUser: null, accessToken: null, sessionHydrated: true }),
}));
