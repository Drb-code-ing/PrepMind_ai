import { getAdminNavItems } from '@/lib/admin-nav';
import { AdminAuthGate } from '@/components/admin-auth-gate';

export default function AdminHomePage() {
  return (
    <AdminAuthGate>
      <main className="min-h-dvh p-8">
        <p className="text-sm font-semibold text-[var(--admin-muted)]">PrepMind Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">后台管理</h1>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {getAdminNavItems().map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg border border-[var(--admin-line)] bg-white p-5 text-sm transition hover:border-[var(--admin-line-strong)]"
            >
              <span className="font-semibold">{item.label}</span>
              <span className="mt-2 block text-[var(--admin-muted)]">{item.description}</span>
            </a>
          ))}
        </div>
      </main>
    </AdminAuthGate>
  );
}
