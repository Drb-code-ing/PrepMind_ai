// 用户状态管理
// 用于管理用户相关的状态，如当前登录用户、所有已注册用户等
// 本地存储,后续可使用数据库存储

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 已注册用户信息（存储在 localStorage） */
export interface RegisteredUser {
  id: string;
  phone?: string;
  email?: string;
  username: string;
  password: string;
  createdAt: string;
}

/** 当前登录用户 */
export interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  phone?: string;
}

interface UserState {
  // 当前登录用户（null 表示未登录）
  currentUser: CurrentUser | null;
  // 所有已注册用户
  users: RegisteredUser[];

  // 注册
  register: (user: Omit<RegisteredUser, 'id' | 'createdAt'>) => { ok: boolean; error?: string };
  // 手机号登录
  loginByPhone: (phone: string, smsCode: string) => { ok: boolean; error?: string };
  // 邮箱登录
  loginByEmail: (email: string, password: string) => { ok: boolean; error?: string };
  // 登出
  logout: () => void;
}

export const FIXED_SMS_CODE = '246810';

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],

      register: (user) => {
        const { users } = get();
        // 检查手机号是否已注册
        if (user.phone && users.some((u) => u.phone === user.phone)) {
          return { ok: false, error: '该手机号已注册' };
        }
        // 检查邮箱是否已注册
        if (user.email && users.some((u) => u.email === user.email)) {
          return { ok: false, error: '该邮箱已注册' };
        }
        // 检查用户名是否已存在
        if (users.some((u) => u.username === user.username)) {
          return { ok: false, error: '该用户名已被占用' };
        }

        const newUser: RegisteredUser = {
          ...user,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set({ users: [...users, newUser] });
        return { ok: true };
      },

      loginByPhone: (phone, smsCode) => {
        if (smsCode !== FIXED_SMS_CODE) {
          return { ok: false, error: '验证码错误' };
        }
        const { users } = get();
        const user = users.find((u) => u.phone === phone);
        if (!user) {
          return { ok: false, error: '该手机号未注册' };
        }
        set({
          currentUser: {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
          },
        });
        return { ok: true };
      },

      loginByEmail: (email, password) => {
        const { users } = get();
        const user = users.find((u) => u.email === email);
        if (!user) {
          return { ok: false, error: '该邮箱未注册' };
        }
        if (user.password !== password) {
          return { ok: false, error: '密码错误' };
        }
        set({
          currentUser: {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
          },
        });
        return { ok: true };
      },

      logout: () => set({ currentUser: null }),
    }),
    {
      name: 'prepmind-user',
    },
  ),
);

export function readUserStoreFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('prepmind-user');
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      state?: Partial<Pick<UserState, 'currentUser' | 'users'>>;
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
      users: Array.isArray(storedState.users) ? storedState.users : [],
    });
  } catch {
    useUserStore.setState({ currentUser: null, users: [] });
  }
}
