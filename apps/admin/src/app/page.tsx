'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Gauge,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { AdminAuthGate } from '@/components/admin-auth-gate';
import { AdminShell } from '@/components/admin-shell';
import {
  buildAdminDashboardOverview,
  formatDashboardTime,
  type AdminDashboardTone,
} from '@/lib/admin-dashboard-view';
import { operatorAuditApi } from '@/lib/operator-audit-api';
import { outboxApi } from '@/lib/outbox-api';
import { getWorkerReadinessLabel } from '@/lib/worker-readiness-view';
import { workerReadinessApi } from '@/lib/worker-readiness-api';
import { useAdminSessionStore } from '@/stores/admin-session-store';

const toneClasses: Record<AdminDashboardTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

const dotClasses: Record<AdminDashboardTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-slate-400',
};

export default function AdminHomePage() {
  return (
    <AdminAuthGate>
      <AdminShell
        title="后台管理"
        description="集中查看系统级诊断、管理员审计和后台任务健康度。这里是桌面端运维入口，不面向普通学习用户。"
      >
        <AdminDashboardPanel />
      </AdminShell>
    </AdminAuthGate>
  );
}

function AdminDashboardPanel() {
  const accessToken = useAdminSessionStore((state) => state.accessToken);
  const readinessQuery = useQuery({
    queryKey: ['worker-readiness', accessToken],
    queryFn: () => workerReadinessApi.get(accessToken ?? ''),
    enabled: Boolean(accessToken),
    refetchInterval: 15000,
  });
  const failedOutboxQuery = useQuery({
    queryKey: ['outbox-events', 'dashboard', 'FAILED', accessToken],
    queryFn: () => outboxApi.list({ status: 'FAILED', limit: 10 }, accessToken ?? ''),
    enabled: Boolean(accessToken),
    refetchInterval: 15000,
  });
  const deadOutboxQuery = useQuery({
    queryKey: ['outbox-events', 'dashboard', 'DEAD', accessToken],
    queryFn: () => outboxApi.list({ status: 'DEAD', limit: 10 }, accessToken ?? ''),
    enabled: Boolean(accessToken),
    refetchInterval: 15000,
  });
  const auditQuery = useQuery({
    queryKey: ['operator-audit-logs', 'dashboard', accessToken],
    queryFn: () =>
      operatorAuditApi.list(
        {
          action: 'OUTBOX_REQUEUE',
          targetType: 'OutboxEvent',
          limit: 5,
        },
        accessToken ?? '',
      ),
    enabled: Boolean(accessToken),
    refetchInterval: 20000,
  });

  const isLoading =
    readinessQuery.isLoading ||
    failedOutboxQuery.isLoading ||
    deadOutboxQuery.isLoading ||
    auditQuery.isLoading;
  const hasReadError =
    readinessQuery.isError ||
    failedOutboxQuery.isError ||
    deadOutboxQuery.isError ||
    auditQuery.isError;
  const failedItems = failedOutboxQuery.data?.items ?? [];
  const deadItems = deadOutboxQuery.data?.items ?? [];
  const auditItems = auditQuery.data?.items ?? [];
  const overview = buildAdminDashboardOverview({
    readiness: readinessQuery.data ?? null,
    failedOutboxEvents: failedItems,
    deadOutboxEvents: deadItems,
    recentAuditLogs: auditItems,
    hasReadError,
  });

  function refreshAll() {
    void readinessQuery.refetch();
    void failedOutboxQuery.refetch();
    void deadOutboxQuery.refetch();
    void auditQuery.refetch();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--admin-line)] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <span
              className={[
                'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-sm font-semibold',
                toneClasses[overview.tone],
              ].join(' ')}
            >
              <span className={['h-2 w-2 rounded-full', dotClasses[overview.tone]].join(' ')} />
              {isLoading ? '读取中' : overview.title}
            </span>
            <h3 className="mt-4 text-2xl font-semibold">后台任务链路概览</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
              {isLoading
                ? '正在读取 Worker Readiness、Outbox 失败事件和最近操作审计。'
                : overview.message}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--admin-ink)] px-4 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <MetricBlock label="关注项" value={overview.attentionCount} tone={overview.tone} />
          <MetricBlock label="FAILED Outbox" value={overview.failedOutboxCount} tone="warning" />
          <MetricBlock label="DEAD Outbox" value={overview.deadOutboxCount} tone="danger" />
          <MetricBlock label="最近审计" value={overview.recentAuditCount} tone="neutral" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="grid gap-4 lg:grid-cols-3">
          <SignalCard
            icon={Gauge}
            label="Worker Readiness"
            title={
              readinessQuery.data ? getWorkerReadinessLabel(readinessQuery.data.status) : '等待读取'
            }
            description={
              readinessQuery.data
                ? `${readinessQuery.data.server.role} / ${readinessQuery.data.server.knowledgeProcessingMode}，issues=${readinessQuery.data.issues.length}`
                : '聚合 Redis、BullMQ、worker heartbeat 与 Outbox backlog。'
            }
            href="/worker"
            cta="查看 Worker 健康"
            tone={
              readinessQuery.data?.status === 'ready'
                ? 'success'
                : readinessQuery.data?.status === 'not_ready'
                  ? 'danger'
                  : readinessQuery.data?.status === 'degraded'
                    ? 'warning'
                    : 'neutral'
            }
          />
          <SignalCard
            icon={ClipboardList}
            label="Outbox Ops"
            title={`${overview.failedOutboxCount + overview.deadOutboxCount} 个异常事件`}
            description="定位 FAILED / DEAD 事件，确认根因后安全重新入队。"
            href="/outbox"
            cta="处理 Outbox"
            tone={
              overview.deadOutboxCount > 0
                ? 'danger'
                : overview.failedOutboxCount > 0
                  ? 'warning'
                  : 'success'
            }
          />
          <SignalCard
            icon={Activity}
            label="操作审计"
            title={`${overview.recentAuditCount} 条最近记录`}
            description="追踪 Outbox requeue 等诊断写操作的脱敏审计记录。"
            href="/audit"
            cta="查看审计"
            tone={auditItems.some((item) => item.status === 'FAILED') ? 'warning' : 'neutral'}
          />
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

      <section className="rounded-lg border border-[var(--admin-line)] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
              最近需要关注
            </p>
            <h3 className="mt-2 text-lg font-semibold">按风险优先处理</h3>
          </div>
          {hasReadError ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              部分数据读取失败
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <AttentionLink
            href="/outbox"
            title="处理队列"
            description={
              deadItems[0]
                ? `优先查看 DEAD 事件：${deadItems[0].type}`
                : failedItems[0]
                  ? `存在 FAILED 事件：${failedItems[0].type}`
                  : '当前没有 FAILED / DEAD 事件。'
            }
          />
          <AttentionLink
            href="/worker"
            title="Worker Readiness"
            description={
              readinessQuery.data?.issues[0] ??
              `最近检查：${formatDashboardTime(readinessQuery.data?.checkedAt)}`
            }
          />
          <AttentionLink
            href="/audit"
            title="操作审计"
            description={
              auditItems[0]
                ? `${auditItems[0].status} / ${formatDashboardTime(auditItems[0].createdAt)} / ${auditItems[0].reason ?? '-'}`
                : '还没有最近 Outbox requeue 审计记录。'
            }
          />
        </div>
      </section>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: AdminDashboardTone;
}) {
  return (
    <div className={['rounded-md border p-4', toneClasses[tone]].join(' ')}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SignalCard({
  icon: Icon,
  label,
  title,
  description,
  href,
  cta,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: AdminDashboardTone;
}) {
  return (
    <article className="rounded-lg border border-[var(--admin-line)] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--admin-line)] bg-slate-50 text-[var(--admin-ink)]">
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={['rounded-full border px-2 py-1 text-xs font-semibold', toneClasses[tone]].join(
            ' ',
          )}
        >
          admin-only
        </span>
      </div>
      <p className="mt-5 text-sm font-semibold text-[var(--admin-muted)]">{label}</p>
      <h4 className="mt-2 text-xl font-semibold">{title}</h4>
      <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
      <Link
        href={href}
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--admin-line)] px-3 text-sm font-semibold text-[var(--admin-ink)] transition hover:border-[var(--admin-line-strong)] hover:bg-slate-50"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function AttentionLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-[var(--admin-line)] p-4 text-sm transition hover:bg-slate-50"
    >
      <span className="font-semibold">{title}</span>
      <span className="mt-2 block text-[var(--admin-muted)]">{description}</span>
    </Link>
  );
}
