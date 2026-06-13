import { create } from 'zustand';

export interface RegisteredUser {
  id: string;
  phone?: string;
  email?: string;
  username: string;
  password: string;
  createdAt: string;
}
export interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role?: 'STUDENT' | 'ADMIN';
  createdAt?: string;
  updatedAt?: string;
}

interface UserState {
  currentUser: CurrentUser | null;
  accessToken: string | null;
  sessionHydrated: boolean;
  setSession: (session: { user: CurrentUser; accessToken: string }) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  setAccessToken: (accessToken: string | null) => void;
  clearSession: () => void;
  setSessionHydrated: (hydrated: boolean) => void;
  register: (user: Omit<RegisteredUser, 'id' | 'createdAt'>) => { ok: boolean; error?: string };
  loginByPhone: (phone: string, smsCode: string) => { ok: boolean; error?: string };
  loginByEmail: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

export const FIXED_SMS_CODE = '246810';

const localAuthDisabled = { ok: false, error: '本地模拟登录已停用，请使用后端 Auth API' };

export const useUserStore = create<UserState>()((set) => ({
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
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ currentUser: null, accessToken: null, sessionHydrated: true }),
  setSessionHydrated: (hydrated) => set({ sessionHydrated: hydrated }),
  register: () => localAuthDisabled,
  loginByPhone: () => localAuthDisabled,
  loginByEmail: () => localAuthDisabled,
  logout: () => set({ currentUser: null, accessToken: null, sessionHydrated: true }),
}));

export function readUserStoreFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('prepmind-user');
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      state?: Partial<Pick<UserState, 'currentUser'>>;
    };
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

export function getStoredCurrentUser() {
  return readUserStoreFromStorage()?.currentUser ?? null;
}

export function hydrateUserStoreFromStorage() {
  const storedState = readUserStoreFromStorage();
  if (!storedState) return;

  try {
    useUserStore.setState({
      currentUser: storedState.currentUser ?? null,
    });
  } catch {
    useUserStore.setState({ currentUser: null, accessToken: null });
  }
}
