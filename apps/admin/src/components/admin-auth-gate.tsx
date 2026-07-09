'use client';

import Link from 'next/link';

import { getAdminGateView } from '@/lib/admin-auth-view';
import { useAdminSessionStore } from '@/stores/admin-session-store';

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const currentUser = useAdminSessionStore((state) => state.currentUser);
  const sessionHydrated = useAdminSessionStore((state) => state.sessionHydrated);
  const view = getAdminGateView({ hydrated: sessionHydrated, user: currentUser });

  if (view.state === 'allowed') return <>{children}</>;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--admin-bg)] px-8">
      <section className="w-full max-w-md rounded-lg border border-[var(--admin-line)] bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">PrepMind Admin</p>
        <h1 className="mt-3 text-2xl font-semibold">{view.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--admin-muted)]">{view.description}</p>
        {view.state === 'anonymous' ? (
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[var(--admin-accent)] px-4 text-sm font-semibold text-white"
          >
            登录后台
          </Link>
        ) : null}
      </section>
    </main>
  );
}
