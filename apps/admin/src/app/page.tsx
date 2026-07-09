import { AdminAuthGate } from '@/components/admin-auth-gate';
import { AdminShell } from '@/components/admin-shell';
import { getAdminNavItems } from '@/lib/admin-nav';

export default function AdminHomePage() {
  return (
    <AdminAuthGate>
      <AdminShell
        title="后台管理"
        description="集中查看系统级诊断、管理员审计和后台任务健康度。这里是桌面端运维入口，不面向普通学习用户。"
      >
        <div className="grid grid-cols-3 gap-4">
          {getAdminNavItems().map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg border border-[var(--admin-line)] bg-white p-5 text-sm shadow-sm transition hover:border-[var(--admin-line-strong)] hover:shadow-md"
            >
              <span className="text-base font-semibold">{item.label}</span>
              <span className="mt-2 block text-[var(--admin-muted)]">{item.description}</span>
            </a>
          ))}
        </div>
      </AdminShell>
    </AdminAuthGate>
  );
}
