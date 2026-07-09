'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ClipboardList, Gauge, LayoutDashboard, LogOut } from 'lucide-react';

import { authApi } from '@/lib/auth-api';
import { getAdminNavItems, type AdminNavIconKey } from '@/lib/admin-nav';
import { resolveLearningAppUrl } from '@/lib/admin-return-url';
import { useAdminSessionStore } from '@/stores/admin-session-store';

const icons: Record<AdminNavIconKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  outbox: ClipboardList,
  audit: Activity,
  worker: Gauge,
};

export function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentUser = useAdminSessionStore((state) => state.currentUser);
  const clearSession = useAdminSessionStore((state) => state.clearSession);
  const learningAppUrl = resolveLearningAppUrl({
    explicitUrl: process.env.NEXT_PUBLIC_LEARNING_APP_URL,
    location: typeof window === 'undefined' ? undefined : window.location,
  });

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      window.location.href = '/login';
    }
  }

  return (
    <div className="admin-shell-grid">
      <aside className="relative border-r border-[var(--admin-line)] bg-[#101828] px-4 py-5 text-white">
        <div className="px-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7dd3c7]">
            PrepMind
          </p>
          <h1 className="mt-2 text-xl font-semibold">Admin Console</h1>
        </div>

        <nav className="mt-8 space-y-1">
          {getAdminNavItems().map((item) => {
            const Icon = icons[item.iconKey];
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition',
                  active
                    ? 'bg-white text-[#101828]'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="truncate text-sm font-semibold">{currentUser?.name ?? 'Admin'}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{currentUser?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="hide-scrollbar min-w-0 overflow-y-auto px-8 py-7">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
              Operator Workspace
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
              {description}
            </p>
          </div>
          <a
            href={learningAppUrl}
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--admin-line)] bg-white px-3 text-sm font-semibold text-[var(--admin-ink)]"
          >
            返回学习端
          </a>
        </header>

        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}
