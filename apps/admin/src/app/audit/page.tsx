'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OperatorAuditStatus } from '@repo/types/api/operator-audit';

import { AdminAuthGate } from '@/components/admin-auth-gate';
import { AdminShell } from '@/components/admin-shell';
import { operatorAuditApi } from '@/lib/operator-audit-api';
import {
  formatOperatorAuditTime,
  getOperatorAuditActionLabel,
  getOperatorAuditStatusLabel,
  getOperatorAuditStatusTone,
  hasOperatorAuditFilters,
} from '@/lib/operator-audit-view';
import { useAdminSessionStore } from '@/stores/admin-session-store';

const statusOptions: Array<'ALL' | OperatorAuditStatus> = ['ALL', 'SUCCEEDED', 'FAILED'];

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
} as const;

export default function AdminAuditPage() {
  return (
    <AdminAuthGate>
      <AdminShell
        title="操作审计"
        description="查看管理员诊断写操作的脱敏审计记录，重点追踪 Outbox requeue 的成功、失败和原因。"
      >
        <OperatorAuditPanel />
      </AdminShell>
    </AdminAuthGate>
  );
}

function OperatorAuditPanel() {
  const accessToken = useAdminSessionStore((state) => state.accessToken);
  const [status, setStatus] = useState<'ALL' | OperatorAuditStatus>('ALL');
  const [targetId, setTargetId] = useState('');
  const [actorUserId, setActorUserId] = useState('');

  const query = {
    action: 'OUTBOX_REQUEUE' as const,
    status: status === 'ALL' ? undefined : status,
    targetType: 'OutboxEvent',
    targetId: targetId.trim() || undefined,
    actorUserId: actorUserId.trim() || undefined,
    limit: 40,
  };

  const logsQuery = useQuery({
    queryKey: ['operator-audit-logs', query, accessToken],
    queryFn: () => operatorAuditApi.list(query, accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const items = logsQuery.data?.items ?? [];

  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
      <div className="grid grid-cols-[12rem_1fr_1fr_auto] gap-3 border-b border-[var(--admin-line)] p-4">
        <label className="block text-sm">
          <span className="font-semibold">状态</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="mt-2 h-10 w-full rounded-md border border-[var(--admin-line)] bg-white px-3"
          >
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item === 'ALL' ? '全部' : getOperatorAuditStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <TextFilter label="Outbox Event ID" value={targetId} onChange={setTargetId} />
        <TextFilter label="Actor User ID" value={actorUserId} onChange={setActorUserId} />

        <button
          type="button"
          onClick={() => logsQuery.refetch()}
          className="mt-7 h-10 rounded-md bg-[var(--admin-ink)] px-4 text-sm font-semibold text-white"
        >
          刷新
        </button>
      </div>

      <div className="divide-y divide-[var(--admin-line)]">
        {logsQuery.isLoading ? <EmptyRow text="正在加载审计记录..." /> : null}
        {logsQuery.isError ? <EmptyRow text="读取失败，请确认审计开关和管理员权限。" /> : null}
        {!logsQuery.isLoading && !logsQuery.isError && items.length === 0 ? (
          <EmptyRow
            text={
              hasOperatorAuditFilters(query)
                ? '当前筛选下没有审计记录。'
                : '还没有管理员诊断写操作。'
            }
          />
        ) : null}
        {items.map((item) => {
          const tone = getOperatorAuditStatusTone(item.status);
          return (
            <article key={item.id} className="grid grid-cols-[9rem_1fr_11rem] gap-4 px-4 py-3">
              <span
                className={[
                  'inline-flex h-7 w-fit items-center rounded-full border px-2.5 text-xs font-semibold',
                  toneClasses[tone],
                ].join(' ')}
              >
                {getOperatorAuditStatusLabel(item.status)}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{getOperatorAuditActionLabel(item.action)}</p>
                <p className="mt-1 truncate text-xs text-[var(--admin-muted)]">
                  target: {item.targetType} / {item.targetId ?? '-'}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--admin-muted)]">
                  reason: {item.reason ?? '-'}
                </p>
                {item.errorPreview ? (
                  <p className="mt-2 break-all rounded-md bg-red-50 p-2 font-mono text-xs text-red-700">
                    {item.errorPreview}
                  </p>
                ) : null}
              </div>
              <div className="text-right text-xs text-[var(--admin-muted)]">
                <p>{formatOperatorAuditTime(item.createdAt)}</p>
                <p className="mt-1 truncate">actor: {item.actorUserId ?? '-'}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TextFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-[var(--admin-line)] px-3"
      />
    </label>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-[var(--admin-muted)]">{text}</p>;
}
