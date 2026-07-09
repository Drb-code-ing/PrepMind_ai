'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  OutboxEventDetailResponse,
  OutboxEventListItem,
  OutboxEventStatus,
} from '@repo/types/api/outbox';

import { AdminAuthGate } from '@/components/admin-auth-gate';
import { AdminShell } from '@/components/admin-shell';
import { ApiClientError } from '@/lib/api-client';
import { outboxApi } from '@/lib/outbox-api';
import {
  formatOutboxTime,
  getOutboxAftercare,
  getOutboxErrorGuidance,
  getOutboxReadOnlyReason,
  getOutboxStatusTone,
  isOutboxEventRequeueable,
  normalizeOutboxReason,
} from '@/lib/outbox-view';
import { useAdminSessionStore } from '@/stores/admin-session-store';

const statuses: Array<'ALL' | OutboxEventStatus> = [
  'ALL',
  'PENDING',
  'PROCESSING',
  'FAILED',
  'DEAD',
  'SUCCEEDED',
];

const toneClasses = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
} as const;

export default function AdminOutboxPage() {
  return (
    <AdminAuthGate>
      <AdminShell
        title="Outbox Ops"
        description="查看系统级 Outbox 事件，定位 FAILED / DEAD 状态，并在确认问题已处理后重新入队。"
      >
        <OutboxOpsPanel />
      </AdminShell>
    </AdminAuthGate>
  );
}

function OutboxOpsPanel() {
  const queryClient = useQueryClient();
  const accessToken = useAdminSessionStore((state) => state.accessToken);
  const [status, setStatus] = useState<'ALL' | OutboxEventStatus>('FAILED');
  const [type, setType] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastRequeued, setLastRequeued] = useState<OutboxEventDetailResponse | null>(null);

  const listQuery = useQuery({
    queryKey: ['outbox-events', status, type, accessToken],
    queryFn: () =>
      outboxApi.list(
        {
          status: status === 'ALL' ? undefined : status,
          type: type.trim() || undefined,
          limit: 30,
        },
        accessToken ?? '',
      ),
    enabled: Boolean(accessToken),
  });

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return items.find((item) => item.id === selectedId) ?? null;
  }, [items, selectedId]);

  const detailQuery = useQuery({
    queryKey: ['outbox-event-detail', selectedId, accessToken],
    queryFn: () => outboxApi.detail(selectedId ?? '', accessToken ?? ''),
    enabled: Boolean(accessToken && selectedId),
  });

  const detailResponse = detailQuery.data ?? null;
  const detail = detailResponse ?? selected;
  const requeueMutation = useMutation({
    mutationFn: (event: OutboxEventDetailResponse | OutboxEventListItem) =>
      outboxApi.requeue(event.id, normalizeOutboxReason(reason), accessToken ?? ''),
    onSuccess: async (nextDetail) => {
      setNotice(`已重新入队：${nextDetail.id}`);
      setLastRequeued(nextDetail);
      setReason('');
      setConfirmChecked(false);
      await queryClient.invalidateQueries({ queryKey: ['outbox-events'] });
      await queryClient.invalidateQueries({ queryKey: ['outbox-event-detail', nextDetail.id] });
      await queryClient.invalidateQueries({ queryKey: ['operator-audit-logs'] });
      await queryClient.invalidateQueries({ queryKey: ['worker-readiness'] });
    },
    onError: (error) => {
      setNotice(error instanceof ApiClientError ? error.message : '重新入队失败，请稍后重试。');
    },
  });

  const canRequeue =
    detail && isOutboxEventRequeueable(detail.status) && detail.canRequeue && confirmChecked;
  const readOnlyReason = detail ? getOutboxReadOnlyReason(detail.status) : null;
  const aftercare = getOutboxAftercare({
    eventId: lastRequeued?.id ?? detail?.id ?? '',
    status: lastRequeued?.status ?? detail?.status ?? 'PENDING',
    requeued: Boolean(lastRequeued),
  });

  return (
    <div className="grid gap-5 lg:h-[calc(100dvh-9rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
        <div className="shrink-0 border-b border-[var(--admin-line)] p-4">
          <div className="grid grid-cols-[12rem_1fr_auto] gap-3">
            <label className="block text-sm">
              <span className="font-semibold">状态</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="mt-2 h-10 w-full rounded-md border border-[var(--admin-line)] bg-white px-3"
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-semibold">事件类型</span>
              <input
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[var(--admin-line)] px-3"
                placeholder="knowledge.document.processing.requested"
              />
            </label>

            <button
              type="button"
              onClick={() => listQuery.refetch()}
              className="mt-7 h-10 rounded-md bg-[var(--admin-ink)] px-4 text-sm font-semibold text-white"
            >
              刷新
            </button>
          </div>
        </div>

        <div
          data-testid="outbox-list-scroll"
          className="pm-scrollbar min-h-0 flex-1 divide-y divide-[var(--admin-line)] overflow-y-auto"
        >
          {listQuery.isLoading ? <EmptyRow text="正在加载 Outbox 事件..." /> : null}
          {listQuery.isError ? <EmptyRow text="读取失败，请确认后端和诊断开关已开启。" /> : null}
          {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
            <EmptyRow text="当前筛选下没有 Outbox 事件。" />
          ) : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={selectedId === item.id}
              onClick={() => {
                setSelectedId(item.id);
                setConfirmChecked(false);
                setLastRequeued(null);
                setNotice(null);
              }}
              className={[
                'relative grid w-full grid-cols-[8rem_minmax(0,1fr)_8rem_7rem] gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50',
                selectedId === item.id ? 'bg-slate-50' : '',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'absolute left-0 top-0 h-full w-1',
                  selectedId === item.id ? 'bg-[var(--admin-accent)]' : 'bg-transparent',
                ].join(' ')}
              />
              <StatusBadge status={item.status} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{item.type}</span>
                <span className="mt-1 block truncate text-xs text-[var(--admin-muted)]">
                  {item.id}
                </span>
              </span>
              <span className="text-xs text-[var(--admin-muted)]">
                {item.attempts}/{item.maxAttempts} 次
              </span>
              <span className="text-xs text-[var(--admin-muted)]">
                {item.canRequeue ? '可重入队' : '只读'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
        <div className="shrink-0 border-b border-[var(--admin-line)] p-5">
          <h3 className="text-lg font-semibold">事件详情</h3>
        </div>
        {!detail ? (
          <p
            data-testid="outbox-detail-scroll"
            className="pm-scrollbar min-h-0 flex-1 overflow-y-auto p-5 text-sm leading-6 text-[var(--admin-muted)]"
          >
            从左侧选择一条事件后，可以查看脱敏错误摘要和重新入队操作。
          </p>
        ) : (
          <div
            data-testid="outbox-detail-scroll"
            className="pm-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm"
          >
            <DetailSection title="生命周期">
              <StatusBadge status={detail.status} />
              <div className="grid grid-cols-2 gap-3">
                <KeyValue label="状态" value={detail.status} />
                <KeyValue label="尝试次数" value={`${detail.attempts}/${detail.maxAttempts}`} />
                <KeyValue label="创建时间" value={formatOutboxTime(detail.createdAt)} />
                <KeyValue label="更新时间" value={formatOutboxTime(detail.updatedAt)} />
                <KeyValue label="下次运行" value={formatOutboxTime(detail.nextRunAt)} />
                <KeyValue label="处理时间" value={formatOutboxTime(detail.processedAt)} />
              </div>
            </DetailSection>

            <DetailSection title="事件身份">
              <KeyValue label="事件 ID" value={detail.id} />
              <KeyValue label="事件类型" value={detail.type} />
              {detailResponse ? (
                <KeyValue label="Payload Hash" value={detailResponse.payloadHash} />
              ) : null}
            </DetailSection>

            {detailResponse ? (
              <DetailSection title="诊断建议">
                <GuidanceBox detail={detailResponse} />
                {readOnlyReason ? (
                  <p className="rounded-md border border-[var(--admin-line)] bg-slate-50 px-3 py-2 text-xs leading-5 text-[var(--admin-muted)]">
                    {readOnlyReason}
                  </p>
                ) : null}
              </DetailSection>
            ) : null}

            <DetailSection title="重新入队操作">
              <p className="text-xs leading-5 text-[var(--admin-muted)]">
                requeue 只会把 FAILED / DEAD 事件安全放回 PENDING，等待 worker dispatcher
                后续 claim；它不会立刻执行 handler、不会改写事件数据、不会绕过状态机标记完成。
              </p>
              <label className="block">
                <span className="font-semibold">操作原因</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-[var(--admin-line)] p-3"
                  maxLength={300}
                  placeholder="例如：已修复 handler 并确认依赖恢复。"
                />
              </label>

              <label className="flex gap-3 rounded-md border border-[var(--admin-line)] bg-slate-50 p-3 text-xs leading-5">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(event) => setConfirmChecked(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                我已确认失败原因已处理，重新入队不会导致重复写入、错误重试风暴或泄露敏感数据。
              </label>

              <button
                type="button"
                disabled={!canRequeue || requeueMutation.isPending}
                onClick={() => detail && requeueMutation.mutate(detail)}
                className="min-h-11 w-full rounded-md bg-[var(--admin-accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#0b6761] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {requeueMutation.isPending ? '正在重新入队...' : '重新入队'}
              </button>

              {notice ? (
                <p className="rounded-md border border-[var(--admin-line)] bg-slate-50 px-3 py-2 text-sm">
                  {notice}
                </p>
              ) : null}
            </DetailSection>

            <DetailSection title="后续验证">
              <AftercareBox aftercare={aftercare} />
            </DetailSection>
          </div>
        )}
      </aside>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-[var(--admin-muted)]">{text}</p>;
}

function StatusBadge({ status }: { status: OutboxEventStatus }) {
  const tone = getOutboxStatusTone(status);
  return (
    <span
      className={[
        'inline-flex h-7 w-fit items-center rounded-full border px-2.5 text-xs font-semibold',
        toneClasses[tone],
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function KeyValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-[var(--admin-ink)]">{value ?? '-'}</p>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-white p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function AftercareBox({ aftercare }: { aftercare: ReturnType<typeof getOutboxAftercare> }) {
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
      <p className="font-semibold">{aftercare.title}</p>
      <p className="mt-1 leading-6">{aftercare.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={aftercare.links.worker.href}
          className="inline-flex min-h-10 items-center rounded-md border border-sky-200 bg-white px-3 text-xs font-semibold"
        >
          {aftercare.links.worker.label}
        </Link>
        <Link
          href={aftercare.links.audit.href}
          className="inline-flex min-h-10 items-center rounded-md border border-sky-200 bg-white px-3 text-xs font-semibold"
        >
          {aftercare.links.audit.label}
        </Link>
      </div>
    </div>
  );
}

function GuidanceBox({ detail }: { detail: OutboxEventDetailResponse }) {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: detail.lastErrorCode,
    lastErrorPreview: detail.lastErrorPreview,
  });

  return (
    <div className={['rounded-md border p-3 text-sm', toneClasses[guidance.tone]].join(' ')}>
      <p className="font-semibold">处理建议</p>
      <p className="mt-1 leading-6">{guidance.message}</p>
      {detail.lastErrorPreview ? (
        <p className="mt-3 break-all font-mono text-xs">{detail.lastErrorPreview}</p>
      ) : null}
    </div>
  );
}
