import Link from 'next/link';
import { Activity, ArrowRight, ClipboardList, Gauge, ShieldCheck } from 'lucide-react';

import { AdminAuthGate } from '@/components/admin-auth-gate';
import { AdminShell } from '@/components/admin-shell';

const dashboardSignals = [
  {
    label: 'Worker Readiness',
    value: '部署前检查',
    description: '聚合 Redis、BullMQ、worker heartbeat 与 Outbox backlog。',
    href: '/worker',
    cta: '查看 Worker 健康',
    icon: Gauge,
  },
  {
    label: 'Outbox Ops',
    value: '失败事件排障',
    description: '定位 FAILED / DEAD 事件，确认根因后安全重新入队。',
    href: '/outbox',
    cta: '处理 Outbox',
    icon: ClipboardList,
  },
  {
    label: '操作审计',
    value: '管理员操作追踪',
    description: '查看 Outbox requeue 等诊断写操作的脱敏审计记录。',
    href: '/audit',
    cta: '查看审计',
    icon: Activity,
  },
];

export default function AdminHomePage() {
  return (
    <AdminAuthGate>
      <AdminShell
        title="后台管理"
        description="集中查看系统级诊断、管理员审计和后台任务健康度。这里是桌面端运维入口，不面向普通学习用户。"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
            <div className="border-b border-[var(--admin-line)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Operations
              </p>
              <h3 className="mt-2 text-lg font-semibold">后台任务链路概览</h3>
            </div>
            <div className="grid divide-y divide-[var(--admin-line)] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              {dashboardSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <article key={signal.href} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--admin-line)] bg-slate-50 text-[var(--admin-ink)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="rounded-full border border-[var(--admin-line)] px-2 py-1 text-xs text-[var(--admin-muted)]">
                        admin-only
                      </span>
                    </div>
                    <p className="mt-5 text-sm font-semibold text-[var(--admin-muted)]">
                      {signal.label}
                    </p>
                    <h4 className="mt-2 text-xl font-semibold">{signal.value}</h4>
                    <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--admin-muted)]">
                      {signal.description}
                    </p>
                    <Link
                      href={signal.href}
                      className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--admin-line)] px-3 text-sm font-semibold text-[var(--admin-ink)] transition hover:border-[var(--admin-line-strong)] hover:bg-slate-50"
                    >
                      {signal.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="rounded-lg border border-[var(--admin-line)] bg-[#111827] p-5 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/10">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-200">
                  Safety Boundary
                </p>
                <h3 className="mt-1 text-lg font-semibold">真正边界在后端</h3>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <p>前端控制台只负责呈现和引导操作，不作为权限事实来源。</p>
              <p>系统级诊断入口仍由 feature gate、JwtAuthGuard、OperatorGuard 和审计日志共同保护。</p>
              <p>Outbox requeue 只改变状态机，不直接执行 handler，也不暴露 payload。</p>
            </div>
          </aside>
        </div>

        <section className="mt-5 rounded-lg border border-[var(--admin-line)] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            最近需要关注
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <Link
              href="/outbox"
              className="rounded-md border border-[var(--admin-line)] p-4 text-sm transition hover:bg-slate-50"
            >
              <span className="font-semibold">处理队列</span>
              <span className="mt-2 block text-[var(--admin-muted)]">
                有 FAILED / DEAD 事件时，先看诊断建议，再决定是否重新入队。
              </span>
            </Link>
            <Link
              href="/worker"
              className="rounded-md border border-[var(--admin-line)] p-4 text-sm transition hover:bg-slate-50"
            >
              <span className="font-semibold">Worker Readiness</span>
              <span className="mt-2 block text-[var(--admin-muted)]">
                部署前或任务异常时，先确认 Redis、队列和 heartbeat。
              </span>
            </Link>
            <Link
              href="/audit"
              className="rounded-md border border-[var(--admin-line)] p-4 text-sm transition hover:bg-slate-50"
            >
              <span className="font-semibold">操作审计</span>
              <span className="mt-2 block text-[var(--admin-muted)]">
                复盘管理员诊断写操作，确认 reason、target 和结果。
              </span>
            </Link>
          </div>
        </section>
      </AdminShell>
    </AdminAuthGate>
  );
}
