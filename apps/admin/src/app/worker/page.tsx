'use client';

import { useQuery } from '@tanstack/react-query';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';

import { AdminAuthGate } from '@/components/admin-auth-gate';
import { AdminShell } from '@/components/admin-shell';
import { workerReadinessApi } from '@/lib/worker-readiness-api';
import {
  formatWorkerReadinessTime,
  getWorkerCheckTone,
  getWorkerReadinessLabel,
  getWorkerReadinessTone,
  summarizeWorkerReadiness,
} from '@/lib/worker-readiness-view';
import { useAdminSessionStore } from '@/stores/admin-session-store';

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
} as const;

export default function AdminWorkerPage() {
  return (
    <AdminAuthGate>
      <AdminShell
        title="Worker Readiness"
        description="用部署视角检查 Redis、BullMQ 队列、worker heartbeat 和 Outbox backlog 是否可以接任务流量。"
      >
        <WorkerReadinessPanel />
      </AdminShell>
    </AdminAuthGate>
  );
}

function WorkerReadinessPanel() {
  const accessToken = useAdminSessionStore((state) => state.accessToken);
  const readinessQuery = useQuery({
    queryKey: ['worker-readiness', accessToken],
    queryFn: () => workerReadinessApi.get(accessToken ?? ''),
    enabled: Boolean(accessToken),
    refetchInterval: 15000,
  });

  if (readinessQuery.isLoading) {
    return <StatePanel text="正在读取 worker readiness..." />;
  }

  if (readinessQuery.isError || !readinessQuery.data) {
    return <StatePanel text="读取失败，请确认后端服务、Redis、诊断开关和管理员权限。" />;
  }

  return <WorkerReadinessContent readiness={readinessQuery.data} onRefresh={readinessQuery.refetch} />;
}

function WorkerReadinessContent({
  readiness,
  onRefresh,
}: {
  readiness: WorkerReadinessResponse;
  onRefresh: () => void;
}) {
  const overallTone = getWorkerReadinessTone(readiness.status);
  const summary = summarizeWorkerReadiness({
    status: readiness.status,
    ready: readiness.ready,
    serverRole: readiness.server.role,
    knowledgeProcessingMode: readiness.server.knowledgeProcessingMode,
    issueCount: readiness.issues.length,
  });

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--admin-line)] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={[
                'inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold',
                toneClasses[overallTone],
              ].join(' ')}
            >
              {getWorkerReadinessLabel(readiness.status)}
            </span>
            <h3 className="mt-4 text-xl font-semibold">{summary}</h3>
            <p className="mt-2 text-sm text-[var(--admin-muted)]">
              checkedAt: {formatWorkerReadinessTime(readiness.checkedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-10 rounded-md bg-[var(--admin-ink)] px-4 text-sm font-semibold text-white"
          >
            刷新
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <CheckCard title="Redis" check={readiness.checks.redis} />
        <CheckCard
          title="BullMQ Queue"
          check={readiness.checks.queue}
          extra={[
            `waiting=${readiness.checks.queue.counts.waiting}`,
            `active=${readiness.checks.queue.counts.active}`,
            `failed=${readiness.checks.queue.counts.failed}`,
            `paused=${readiness.checks.queue.isPaused}`,
          ]}
        />
        <CheckCard
          title="Worker Heartbeat"
          check={readiness.checks.workers}
          extra={[
            `online=${readiness.checks.workers.onlineCount}`,
            `latest=${formatWorkerReadinessTime(readiness.checks.workers.latestHeartbeatAt)}`,
          ]}
        />
        <CheckCard
          title="Outbox"
          check={readiness.checks.outbox}
          extra={[
            `dead=${readiness.checks.outbox.deadCount}`,
            `backlog=${readiness.checks.outbox.hasBacklog}`,
            `oldestPendingAgeMs=${readiness.checks.outbox.oldestPendingAgeMs ?? '-'}`,
          ]}
        />
      </section>

      <section className="rounded-lg border border-[var(--admin-line)] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Issues</h3>
        {readiness.issues.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">没有 readiness issue。</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {readiness.issues.map((issue) => (
              <li key={issue} className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
                {issue}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CheckCard({
  title,
  check,
  extra = [],
}: {
  title: string;
  check: WorkerReadinessResponse['checks']['redis'];
  extra?: string[];
}) {
  const tone = getWorkerCheckTone(check.status);
  return (
    <article className="rounded-lg border border-[var(--admin-line)] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <span
          className={[
            'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold',
            toneClasses[tone],
          ].join(' ')}
        >
          {check.status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--admin-muted)]">{check.message}</p>
      {extra.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {extra.map((item) => (
            <span key={item} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function StatePanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[var(--admin-line)] bg-white p-8 text-center text-sm text-[var(--admin-muted)] shadow-sm">
      {text}
    </div>
  );
}
