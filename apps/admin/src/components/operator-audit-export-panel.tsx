'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { Copy, Download } from 'lucide-react';
import type { OperatorAuditExportCreateRequest } from '@repo/types/api/operator-audit-export';
import type {
  OperatorAuditExportDetailResponse,
  OperatorAuditExportListResponse,
} from '@repo/types/api/operator-audit-export';

import type { AuditFilterState } from '@/app/audit/page';
import { SelectableActionRow } from '@/components/operator-audit-workspace';
import { ApiClientError } from '@/lib/api-client';
import { operatorAuditExportApi } from '@/lib/operator-audit-export-api';
import {
  canDownloadOperatorAuditExport,
  getOperatorAuditExportPollInterval,
  getOperatorAuditExportStatusPresentation,
  mergeOperatorAuditExportPages,
  transitionOperatorAuditExportRequest,
  triggerOperatorAuditExportDownload,
  validateOperatorAuditExportRange,
} from '@/lib/operator-audit-export-view';
import { formatOperatorAuditTime, getOperatorAuditActionLabel } from '@/lib/operator-audit-view';
import { useAdminSessionStore } from '@/stores/admin-session-store';

const exportToneClasses = {
  queued: 'border-slate-300 bg-slate-50 text-slate-700',
  processing: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  expired: 'border-amber-200 bg-amber-50 text-amber-800',
} as const;

type FormErrors = {
  startAt?: string;
  endAt?: string;
  reason?: string;
};

export function OperatorAuditExportPanel({ defaultFilters }: { defaultFilters: AuditFilterState }) {
  const accessToken = useAdminSessionStore((state) => state.accessToken);
  const [startAt, setStartAt] = useState(() => toLocalDateTime(new Date(Date.now() - 86400000)));
  const [endAt, setEndAt] = useState(() => toLocalDateTime(new Date()));
  const [reason, setReason] = useState('运维审计复盘');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [pendingRequest, setPendingRequest] =
    useState<ReturnType<typeof transitionOperatorAuditExportRequest>>(null);
  const [isPending, setIsPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadPendingId, setDownloadPendingId] = useState<string | null>(null);

  const exportsQuery = useInfiniteQuery({
    queryKey: ['operator-audit-exports', accessToken],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      operatorAuditExportApi.list({ limit: 30, cursor: pageParam ?? undefined }, accessToken ?? ''),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accessToken),
    refetchInterval: (query) =>
      getOperatorAuditExportPollInterval(
        flattenExportPages(
          query.state.data as
            | InfiniteData<OperatorAuditExportListResponse, string | null>
            | undefined,
        ),
      ),
  });

  const items = useMemo(
    () => mergeOperatorAuditExportPages(exportsQuery.data?.pages.map((page) => page.items) ?? []),
    [exportsQuery.data],
  );
  const selectedFromList = selectedId
    ? (items.find((item) => item.id === selectedId) ?? null)
    : null;
  const detailQuery = useQuery({
    queryKey: ['operator-audit-export-detail', selectedId, accessToken],
    queryFn: () => operatorAuditExportApi.detail(selectedId ?? '', accessToken ?? ''),
    enabled: Boolean(accessToken && selectedId),
    refetchInterval: (query) => {
      const detail = query.state.data;
      return detail?.status === 'QUEUED' || detail?.status === 'PROCESSING' ? 5000 : false;
    },
  });
  const detail = detailQuery.data ?? selectedFromList;

  function updateField(setter: (value: string) => void, value: string) {
    setter(value);
    setPendingRequest((current) =>
      transitionOperatorAuditExportRequest(current, { type: 'request-changed' }),
    );
    setFormErrors({});
    setNotice(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rangeErrors = validateOperatorAuditExportRange(startAt, endAt);
    const nextErrors: FormErrors = { ...rangeErrors };
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) nextErrors.reason = '申请原因至少需要 3 个字符。';
    if (normalizedReason.length > 240) nextErrors.reason = '申请原因不能超过 240 个字符。';
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !accessToken) return;

    const requestSignature = JSON.stringify({
      startAt,
      endAt,
      reason: normalizedReason,
      filters: normalizeInheritedFilters(defaultFilters),
    });
    const nextPendingRequest = transitionOperatorAuditExportRequest(pendingRequest, {
      type: 'submit',
      requestSignature,
      generatedClientRequestId: crypto.randomUUID(),
    });
    if (!nextPendingRequest) return;
    const requestId = nextPendingRequest.clientRequestId;
    setPendingRequest(nextPendingRequest);
    setIsPending(true);
    setNotice(null);

    try {
      const created = await operatorAuditExportApi.create(
        {
          clientRequestId: requestId,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          reason: normalizedReason,
          ...normalizeInheritedFilters(defaultFilters),
        },
        accessToken,
      );
      setPendingRequest((current) =>
        transitionOperatorAuditExportRequest(current, { type: 'success' }),
      );
      setSelectedId(created.id);
      setNotice('申请已提交，证据包正在排队。');
      await exportsQuery.refetch();
    } catch (error) {
      const retryMustReuseRequestId =
        !(error instanceof ApiClientError) || error.status === 0 || error.status >= 500;
      setPendingRequest((current) =>
        transitionOperatorAuditExportRequest(current, {
          type: retryMustReuseRequestId ? 'retryable-failure' : 'final-failure',
        }),
      );
      setNotice(
        error instanceof ApiClientError ? error.message : '申请失败，请保持表单不变后重试。',
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleDownload(item: OperatorAuditExportDetailResponse) {
    if (!accessToken || !canDownloadOperatorAuditExport(item)) return;
    setDownloadPendingId(item.id);
    setNotice(null);
    try {
      const file = await operatorAuditExportApi.download(item.id, accessToken);
      triggerOperatorAuditExportDownload(file);
      setNotice(`已开始下载 ${file.fileName}`);
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : '下载失败，请稍后重试。');
    } finally {
      setDownloadPendingId(null);
    }
  }

  async function handleCopyHash(hash: string | null) {
    if (!hash) {
      setNotice('当前证据包没有可复制的 ZIP SHA-256。');
      return;
    }
    try {
      await navigator.clipboard.writeText(hash);
      setNotice('ZIP SHA-256 已复制。');
    } catch {
      setNotice('复制失败，请手动选择详情中的哈希值。');
    }
  }

  return (
    <div className="flex h-[calc(100dvh-12.5rem)] min-h-[34rem] flex-col gap-3">
      <form
        onSubmit={handleSubmit}
        className="grid shrink-0 grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(13rem,1.35fr)_auto] items-end gap-3 border-y border-[var(--admin-line)] bg-white px-4 py-3"
      >
        <DateTimeField
          id="audit-export-start"
          label="开始时间"
          value={startAt}
          error={formErrors.startAt}
          hint="使用浏览器本地时区"
          onChange={(value) => updateField(setStartAt, value)}
        />
        <DateTimeField
          id="audit-export-end"
          label="结束时间"
          value={endAt}
          error={formErrors.endAt}
          hint="结束时间必须晚于开始时间"
          onChange={(value) => updateField(setEndAt, value)}
        />
        <label className="block min-w-0 text-sm" htmlFor="audit-export-reason">
          <span className="font-semibold">申请原因</span>
          <input
            id="audit-export-reason"
            value={reason}
            maxLength={240}
            aria-invalid={Boolean(formErrors.reason)}
            aria-describedby={
              formErrors.reason
                ? 'audit-export-reason-hint audit-export-reason-error'
                : 'audit-export-reason-hint'
            }
            onChange={(event) => updateField(setReason, event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-[var(--admin-line)] px-3 focus:outline-none focus:ring-2 focus:ring-[rgba(15,118,110,0.2)]"
          />
          <span
            id="audit-export-reason-hint"
            className="mt-1 block text-xs text-[var(--admin-muted)]"
          >
            3–240 字符，用于说明审计目的
          </span>
          {formErrors.reason ? (
            <span id="audit-export-reason-error" className="mt-1 block text-xs text-red-700">
              {formErrors.reason}
            </span>
          ) : null}
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="mb-5 h-10 rounded-md bg-[var(--admin-accent)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isPending ? '正在提交...' : '申请证据包'}
        </button>

        <div className="col-span-full flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--admin-muted)]">
          <span className="font-semibold text-[var(--admin-ink)]">继承当前审计筛选</span>
          <span>操作：{formatInheritedAction(defaultFilters.action)}</span>
          <span>结果：{formatInheritedFilter(defaultFilters.status)}</span>
          <span className="break-all">
            Target：{defaultFilters.targetType || '全部'} / {defaultFilters.targetId || '全部'}
          </span>
          <span className="break-all">Actor：{defaultFilters.actorUserId || '全部'}</span>
          <span className="ml-auto font-semibold text-[var(--admin-ink)]">
            最长 31 天 · 最多 50,000 条记录
          </span>
        </div>
        {notice ? (
          <p role="status" className="col-span-full text-sm text-[var(--admin-accent)]">
            {notice}
          </p>
        ) : null}
      </form>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(20rem,1fr)_20rem] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
          <div className="flex h-13 shrink-0 items-center justify-between border-b border-[var(--admin-line)] px-4">
            <div>
              <h2 className="text-sm font-semibold">证据包申请</h2>
              <p className="text-xs text-[var(--admin-muted)]">
                按创建时间倒序，活动任务每 5 秒更新
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportsQuery.refetch()}
              className="min-h-10 rounded-md border border-[var(--admin-line)] px-3 text-sm font-semibold"
            >
              刷新
            </button>
          </div>

          <div className="pm-scrollbar min-h-0 flex-1 divide-y divide-[var(--admin-line)] overflow-y-auto">
            {exportsQuery.isLoading ? <EmptyState text="正在读取证据包申请..." /> : null}
            {exportsQuery.isError ? (
              <EmptyState text="读取失败，请确认导出开关和管理员权限。" />
            ) : null}
            {!exportsQuery.isLoading && !exportsQuery.isError && items.length === 0 ? (
              <EmptyState text="还没有证据包申请。" />
            ) : null}
            {items.map((item) => {
              const status = getOperatorAuditExportStatusPresentation(item.status);
              const downloadable = canDownloadOperatorAuditExport(item);
              return (
                <SelectableActionRow
                  key={item.id}
                  label={`证据包 ${item.id}`}
                  selected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  actions={
                    downloadable ? (
                      <>
                        <IconButton
                          ariaLabel="下载证据包"
                          title="下载证据包"
                          disabled={downloadPendingId === item.id}
                          onClick={() => handleDownload(item)}
                        >
                          <Download aria-hidden="true" size={16} />
                        </IconButton>
                        <IconButton
                          ariaLabel="复制 ZIP SHA-256"
                          title="复制 ZIP SHA-256"
                          onClick={() => handleCopyHash(item.archiveSha256)}
                        >
                          <Copy aria-hidden="true" size={16} />
                        </IconButton>
                      </>
                    ) : undefined
                  }
                >
                  <ExportStatusBadge item={item} />
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-xs font-semibold">
                      {item.id}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                      {status.description}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                      {formatOperatorAuditTime(item.createdAt)} · {item.recordCount ?? '-'} 条
                    </span>
                    {item.status === 'FAILED' ? (
                      <span className="mt-2 block text-xs font-semibold text-red-700">
                        请缩小时间范围后重新申请。
                      </span>
                    ) : null}
                    {item.status === 'EXPIRED' ? (
                      <span className="mt-2 block text-xs font-semibold text-amber-800">
                        文件已删除；需要时请重新申请。
                      </span>
                    ) : null}
                  </span>
                </SelectableActionRow>
              );
            })}
            {exportsQuery.hasNextPage ? (
              <div className="p-3 text-center">
                <button
                  type="button"
                  disabled={exportsQuery.isFetchingNextPage}
                  onClick={() => exportsQuery.fetchNextPage()}
                  className="min-h-10 rounded-md border border-[var(--admin-line)] px-4 text-sm font-semibold disabled:opacity-55"
                >
                  {exportsQuery.isFetchingNextPage ? '正在加载...' : '加载更早申请'}
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="flex min-h-0 w-80 flex-col overflow-hidden rounded-lg border border-[var(--admin-line)] bg-white shadow-sm">
          <div className="shrink-0 border-b border-[var(--admin-line)] p-4">
            <h2 className="text-base font-semibold">证据包详情</h2>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">安全 DTO · SYSTEM 后台任务</p>
          </div>
          {!detail ? (
            <EmptyState text="从左侧选择一条申请，查看筛选、生成信息与安全错误摘要。" />
          ) : (
            <div className="pm-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {detailQuery.isError ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  详情读取失败。
                </p>
              ) : null}
              <DetailBlock title="状态与范围">
                <ExportStatusBadge item={detail} />
                <DetailValue label="证据包 ID" value={detail.id} />
                <DetailValue label="申请人 User ID" value={detail.requestedByUserId} />
                <DetailValue label="申请原因" value={detail.reason} mono={false} />
                <DetailValue label="开始时间" value={formatOperatorAuditTime(detail.startAt)} />
                <DetailValue label="结束时间" value={formatOperatorAuditTime(detail.endAt)} />
                <DetailValue label="快照时间" value={formatOperatorAuditTime(detail.snapshotAt)} />
              </DetailBlock>
              <DetailBlock title="继承筛选">
                <DetailValue
                  label="操作"
                  value={
                    detail.filters.action
                      ? getOperatorAuditActionLabel(detail.filters.action)
                      : '全部'
                  }
                  mono={false}
                />
                <DetailValue label="结果" value={detail.filters.status ?? '全部'} mono={false} />
                <DetailValue label="Target Type" value={detail.filters.targetType} />
                <DetailValue label="Target ID" value={detail.filters.targetId} />
                <DetailValue label="Actor User ID" value={detail.filters.actorUserId} />
              </DetailBlock>
              <DetailBlock title="生成结果">
                <DetailValue label="SYSTEM BackgroundJob ID" value={detail.backgroundJobId} />
                <DetailValue
                  label="记录数"
                  value={detail.recordCount?.toLocaleString('zh-CN') ?? null}
                />
                <DetailValue label="文件大小" value={formatFileSize(detail.archiveSize)} />
                <DetailValue label="CSV SHA-256" value={detail.csvSha256} />
                <DetailValue label="ZIP SHA-256" value={detail.archiveSha256} />
                <DetailValue label="Schema Version" value={String(detail.schemaVersion)} />
              </DetailBlock>
              <DetailBlock title="时间线">
                <DetailValue label="申请" value={formatOptionalTime(detail.requestedAt)} />
                <DetailValue label="开始" value={formatOptionalTime(detail.startedAt)} />
                <DetailValue label="完成" value={formatOptionalTime(detail.completedAt)} />
                <DetailValue label="到期" value={formatOptionalTime(detail.expiresAt)} />
                <DetailValue label="删除" value={formatOptionalTime(detail.expiredAt)} />
              </DetailBlock>
              {detail.status === 'FAILED' ? (
                <DetailBlock title="安全错误摘要">
                  <DetailValue label="错误码" value={detail.errorCode} />
                  <p className="break-all rounded-md bg-red-50 p-3 font-mono text-xs text-red-700">
                    {detail.errorPreview ?? '-'}
                  </p>
                  <p className="text-xs font-semibold text-red-700">请缩小时间范围后重新申请。</p>
                </DetailBlock>
              ) : null}
              {detail.status === 'EXPIRED' ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  文件已删除，当前记录仅用于审计复盘；如仍需要证据包，请重新申请。
                </p>
              ) : null}
              {canDownloadOperatorAuditExport(detail) ? (
                <div className="flex gap-2 border-t border-[var(--admin-line)] pt-4">
                  <button
                    type="button"
                    aria-label="下载证据包"
                    title="下载证据包"
                    disabled={downloadPendingId === detail.id}
                    onClick={() => handleDownload(detail)}
                    className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-semibold text-white disabled:opacity-55"
                  >
                    <Download aria-hidden="true" size={16} /> 下载
                  </button>
                  <button
                    type="button"
                    aria-label="复制 ZIP SHA-256"
                    title="复制 ZIP SHA-256"
                    onClick={() => handleCopyHash(detail.archiveSha256)}
                    className="flex min-h-10 items-center justify-center rounded-md border border-[var(--admin-line)] px-3"
                  >
                    <Copy aria-hidden="true" size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DateTimeField({
  id,
  label,
  value,
  hint,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="font-semibold">{label}</span>
      <input
        id={id}
        type="datetime-local"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-[var(--admin-line)] px-3 focus:outline-none focus:ring-2 focus:ring-[rgba(15,118,110,0.2)]"
      />
      <span id={hintId} className="mt-1 block text-xs text-[var(--admin-muted)]">
        {hint}
      </span>
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ExportStatusBadge({ item }: { item: OperatorAuditExportDetailResponse }) {
  const status = getOperatorAuditExportStatusPresentation(item.status);
  return (
    <span
      className={[
        'inline-flex min-h-7 w-fit items-center rounded-full border px-2.5 text-xs font-semibold',
        exportToneClasses[status.tone],
      ].join(' ')}
      title={status.description}
    >
      {status.label}
    </span>
  );
}

function IconButton({
  ariaLabel,
  title,
  disabled = false,
  onClick,
  children,
}: {
  ariaLabel: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-md border border-[var(--admin-line)] bg-white hover:border-[var(--admin-accent)] disabled:opacity-55"
    >
      {children}
    </button>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="border-b border-[var(--admin-line)] pb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function DetailValue({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-[var(--admin-muted)]">{label}</p>
      <p className={['mt-1 break-all text-xs leading-5', mono ? 'font-mono' : ''].join(' ')}>
        {value ?? '-'}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="p-6 text-center text-sm leading-6 text-[var(--admin-muted)]">{text}</p>;
}

function flattenExportPages(
  data: InfiniteData<OperatorAuditExportListResponse, unknown> | undefined,
) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

function normalizeInheritedFilters(
  filters: AuditFilterState,
): Partial<OperatorAuditExportCreateRequest> {
  return {
    action: filters.action === 'ALL' ? undefined : filters.action,
    status: filters.status === 'ALL' ? undefined : filters.status,
    targetType: filters.targetType.trim() || undefined,
    targetId: filters.targetId.trim() || undefined,
    actorUserId: filters.actorUserId.trim() || undefined,
  };
}

function formatInheritedFilter(value: string) {
  if (value === 'ALL' || !value) return '全部';
  return value;
}

function formatInheritedAction(action: AuditFilterState['action']) {
  return action === 'ALL' ? '全部' : getOperatorAuditActionLabel(action);
}

function formatFileSize(bytes: number | null) {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function formatOptionalTime(value: string | null) {
  return value ? formatOperatorAuditTime(value) : null;
}

function toLocalDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
