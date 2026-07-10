'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OperatorAuditAction, OperatorAuditStatus } from '@repo/types/api/operator-audit';

import { AdminAuthGate } from '@/components/admin-auth-gate';
import { AdminFilterSelect } from '@/components/admin-filter-select';
import { AdminShell } from '@/components/admin-shell';
import { OperatorAuditExportPanel } from '@/components/operator-audit-export-panel';
import { AuditWorkspaceTabs } from '@/components/operator-audit-workspace';
import { operatorAuditApi } from '@/lib/operator-audit-api';
import {
  formatOperatorAuditTime,
  getOperatorAuditActionLabel,
  getOperatorAuditStatusLabel,
  getOperatorAuditStatusTone,
  hasOperatorAuditFilters,
} from '@/lib/operator-audit-view';
import { useAdminSessionStore } from '@/stores/admin-session-store';

export type AuditFilterState = {
  action: OperatorAuditAction | 'ALL';
  status: OperatorAuditStatus | 'ALL';
  targetType: string;
  targetId: string;
  actorUserId: string;
};

const auditActionOptions: Array<{
  value: AuditFilterState['action'];
  label: string;
  description: string;
}> = [
  { value: 'ALL', label: '全部操作', description: '不限制审计动作' },
  {
    value: 'OUTBOX_REQUEUE',
    label: getOperatorAuditActionLabel('OUTBOX_REQUEUE'),
    description: 'Outbox 事件人工重新入队',
  },
  {
    value: 'AUDIT_EXPORT_REQUEST',
    label: getOperatorAuditActionLabel('AUDIT_EXPORT_REQUEST'),
    description: '证据包申请留痕',
  },
  {
    value: 'AUDIT_EXPORT_DOWNLOAD',
    label: getOperatorAuditActionLabel('AUDIT_EXPORT_DOWNLOAD'),
    description: '证据包下载授权留痕',
  },
];

const auditStatusOptions: Array<{
  value: AuditFilterState['status'];
  label: string;
  description: string;
}> = [
  { value: 'ALL', label: '全部结果', description: '查看成功与失败' },
  { value: 'SUCCEEDED', label: '成功', description: '已授权或已完成的操作' },
  { value: 'FAILED', label: '失败', description: '需要复盘的操作' },
];

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
} as const;

export default function AdminAuditPage() {
  const [filters, setFilters] = useState<AuditFilterState>({
    action: 'OUTBOX_REQUEUE',
    status: 'ALL',
    targetType: 'OutboxEvent',
    targetId: '',
    actorUserId: '',
  });
  return (
    <AdminAuthGate>
      <AdminShell
        title="操作审计"
        description="查询管理员操作留痕，并按同一组脱敏筛选条件申请审计证据包。"
      >
        <AuditWorkspaceTabs
          records={<OperatorAuditPanel filters={filters} onFiltersChange={setFilters} />}
          exports={
            <OperatorAuditExportPanel key={JSON.stringify(filters)} defaultFilters={filters} />
          }
        />
      </AdminShell>
    </AdminAuthGate>
  );
}

function OperatorAuditPanel({
  filters,
  onFiltersChange,
}: {
  filters: AuditFilterState;
  onFiltersChange: (filters: AuditFilterState) => void;
}) {
  const accessToken = useAdminSessionStore((state) => state.accessToken);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = {
    action: filters.action === 'ALL' ? undefined : filters.action,
    status: filters.status === 'ALL' ? undefined : filters.status,
    targetType: filters.targetType.trim() || undefined,
    targetId: filters.targetId.trim() || undefined,
    actorUserId: filters.actorUserId.trim() || undefined,
    limit: 40,
  };

  const logsQuery = useQuery({
    queryKey: ['operator-audit-logs', query, accessToken],
    queryFn: () => operatorAuditApi.list(query, accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const items = logsQuery.data?.items ?? [];
  const selectedFromList = selectedId
    ? (items.find((item) => item.id === selectedId) ?? null)
    : null;
  const detailQuery = useQuery({
    queryKey: ['operator-audit-log-detail', selectedId, accessToken],
    queryFn: () => operatorAuditApi.detail(selectedId ?? '', accessToken ?? ''),
    enabled: Boolean(accessToken && selectedId),
  });
  const detail = detailQuery.data ?? selectedFromList;

  function updateFilters(patch: Partial<AuditFilterState>) {
    onFiltersChange({ ...filters, ...patch });
    setSelectedId(null);
  }

  return (
    <div className="grid h-[calc(100dvh-12.5rem)] min-h-[34rem] grid-cols-[minmax(20rem,1fr)_20rem] gap-4">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-[var(--admin-line)] p-4 xl:grid-cols-[minmax(10rem,0.8fr)_minmax(9rem,0.7fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_auto]">
          <AdminFilterSelect
            label="操作类型"
            value={filters.action}
            options={auditActionOptions}
            onChange={(action) => updateFilters({ action })}
          />
          <AdminFilterSelect
            label="结果"
            value={filters.status}
            options={auditStatusOptions}
            onChange={(status) => updateFilters({ status })}
          />
          <TextFilter
            label="Target Type"
            value={filters.targetType}
            onChange={(targetType) => updateFilters({ targetType })}
          />
          <TextFilter
            label="Target / Event ID"
            value={filters.targetId}
            onChange={(targetId) => updateFilters({ targetId })}
          />
          <TextFilter
            label="Actor User ID"
            value={filters.actorUserId}
            onChange={(actorUserId) => updateFilters({ actorUserId })}
          />
          <button
            type="button"
            onClick={() => logsQuery.refetch()}
            className="mt-7 h-10 rounded-md bg-[var(--admin-ink)] px-4 text-sm font-semibold text-white xl:col-auto"
          >
            刷新
          </button>
        </div>

        <div className="pm-scrollbar min-h-0 flex-1 divide-y divide-[var(--admin-line)] overflow-y-auto">
          {logsQuery.isLoading ? <EmptyRow text="正在加载审计记录..." /> : null}
          {logsQuery.isError ? <EmptyRow text="读取失败，请确认审计开关和管理员权限。" /> : null}
          {!logsQuery.isLoading && !logsQuery.isError && items.length === 0 ? (
            <EmptyRow
              text={
                hasOperatorAuditFilters(query) ? '当前筛选下没有审计记录。' : '还没有审计记录。'
              }
            />
          ) : null}
          {items.map((item) => {
            const tone = getOperatorAuditStatusTone(item.status);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selectedId === item.id}
                onClick={() => setSelectedId(item.id)}
                className={[
                  'relative grid w-full grid-cols-[7rem_minmax(0,1fr)] gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
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
                <span
                  className={[
                    'inline-flex h-7 w-fit items-center rounded-full border px-2.5 text-xs font-semibold',
                    toneClasses[tone],
                  ].join(' ')}
                >
                  {getOperatorAuditStatusLabel(item.status)}
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold">
                    {getOperatorAuditActionLabel(item.action)}
                  </span>
                  <span className="mt-1 block break-all text-xs text-[var(--admin-muted)]">
                    {item.targetType} / {item.targetId ?? '-'}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                    {formatOperatorAuditTime(item.createdAt)} · actor {item.actorUserId ?? '-'}
                  </span>
                  {item.reason ? (
                    <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                      原因：{item.reason}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="flex min-h-0 w-80 flex-col overflow-hidden rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
        <div className="shrink-0 border-b border-[var(--admin-line)] p-5">
          <h3 className="text-lg font-semibold">审计详情</h3>
        </div>
        {!detail ? (
          <p className="pm-scrollbar min-h-0 flex-1 overflow-y-auto p-5 text-sm leading-6 text-[var(--admin-muted)]">
            从左侧选择一条审计记录后，可以查看操作上下文、来源指纹和错误摘要。
          </p>
        ) : (
          <div className="pm-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm">
            {detailQuery.isError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                详情读取失败，请确认审计开关和管理员权限。
              </p>
            ) : null}
            <DetailSection title="操作上下文">
              <StatusBadge status={detail.status} />
              <KeyValue label="审计 ID" value={detail.id} />
              <KeyValue label="操作类型" value={getOperatorAuditActionLabel(detail.action)} />
              <KeyValue label="操作结果" value={getOperatorAuditStatusLabel(detail.status)} />
              <KeyValue label="操作原因" value={detail.reason} />
              <KeyValue label="创建时间" value={formatOperatorAuditTime(detail.createdAt)} />
            </DetailSection>
            <DetailSection title="目标对象">
              <KeyValue label="Target Type" value={detail.targetType} />
              <KeyValue label="Target ID" value={detail.targetId} />
            </DetailSection>
            <DetailSection title="来源指纹">
              <KeyValue label="Actor User ID" value={detail.actorUserId} />
              <KeyValue label="Request ID" value={detail.requestId} />
              <KeyValue label="IP Hash" value={detail.ipAddressHash} />
              <KeyValue label="User-Agent Hash" value={detail.userAgentHash} />
            </DetailSection>
            <DetailSection title="错误摘要">
              {detail.errorCode || detail.errorPreview ? (
                <>
                  <KeyValue label="Error Code" value={detail.errorCode} />
                  <p className="break-all rounded-md bg-red-50 p-3 font-mono text-xs text-red-700">
                    {detail.errorPreview ?? '-'}
                  </p>
                </>
              ) : (
                <p className="rounded-md border border-[var(--admin-line)] bg-slate-50 px-3 py-2 text-xs leading-5 text-[var(--admin-muted)]">
                  这次操作没有错误摘要。
                </p>
              )}
            </DetailSection>
          </div>
        )}
      </aside>
    </div>
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

function StatusBadge({ status }: { status: OperatorAuditStatus }) {
  const tone = getOperatorAuditStatusTone(status);
  return (
    <span
      className={[
        'inline-flex h-7 w-fit items-center rounded-full border px-2.5 text-xs font-semibold',
        toneClasses[tone],
      ].join(' ')}
    >
      {getOperatorAuditStatusLabel(status)}
    </span>
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

function KeyValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-[var(--admin-ink)]">{value ?? '-'}</p>
    </div>
  );
}
