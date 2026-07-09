'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  OperatorAuditLogListItem,
  OperatorAuditLogListQuery,
} from '@repo/types/api/operator-audit';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Filter,
  Fingerprint,
  Hash,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

import { useOperatorAuditLogs } from '@/hooks/use-operator-audit-logs';
import {
  formatOperatorAuditDateTime,
  getOperatorAuditActionLabel,
  getOperatorAuditStatusLabel,
  getOperatorAuditStatusTone,
  hasOperatorAuditFilters,
} from '@/lib/operator-audit-view';
import { useUserStore } from '@/stores/userStore';

type FilterFormState = {
  action: '' | 'OUTBOX_REQUEUE';
  status: '' | 'SUCCEEDED' | 'FAILED';
  targetType: string;
  targetId: string;
  actorUserId: string;
};

type FilterSelectOption<T extends string> = {
  value: T;
  label: string;
};

const defaultFilters: FilterFormState = {
  action: '',
  status: '',
  targetType: '',
  targetId: '',
  actorUserId: '',
};

const pageLimit = 20;

const actionFilterOptions: Array<FilterSelectOption<FilterFormState['action']>> = [
  { value: '', label: '全部操作' },
  { value: 'OUTBOX_REQUEUE', label: 'Outbox 重新入队' },
];

const statusFilterOptions: Array<FilterSelectOption<FilterFormState['status']>> = [
  { value: '', label: '全部结果' },
  { value: 'SUCCEEDED', label: '成功' },
  { value: 'FAILED', label: '失败' },
];

export default function OperatorAuditPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [filters, setFilters] = useState<FilterFormState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<Partial<OperatorAuditLogListQuery>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<'action' | 'status' | null>(null);

  const query = useMemo(
    () => ({
      ...appliedFilters,
      limit: pageLimit,
      cursor: cursor ?? undefined,
    }),
    [appliedFilters, cursor],
  );

  const logsQuery = useOperatorAuditLogs(query, { enabled: isAdmin });
  const items = logsQuery.data?.items ?? [];
  const activeFilters = hasOperatorAuditFilters(appliedFilters);
  const hasDraftFilters = hasOperatorAuditFilters(normalizeFilters(filters));
  const isFirstPageLoading = logsQuery.isLoading && !cursor;

  function applyFilters() {
    setCursor(null);
    setAppliedFilters(normalizeFilters(filters));
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setCursor(null);
    setAppliedFilters({});
  }

  function refreshLogs() {
    if (cursor) {
      setCursor(null);
      return;
    }

    void logsQuery.refetch();
  }

  if (!sessionHydrated) {
    return <Shell title="操作审计" subtitle="Operator audit" icon={<ShieldCheck className="h-5 w-5" />}>
      <LoadingSkeleton />
    </Shell>;
  }

  if (!isAdmin) {
    return <NoPermissionState />;
  }

  return (
    <Shell title="操作审计" subtitle="Operator audit" icon={<ShieldCheck className="h-5 w-5" />}>
      <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--pm-muted)]">
              仅展示脱敏后的管理员操作记录
            </p>
            <h2 className="mt-1 text-base font-semibold">审计筛选</h2>
          </div>
          <button
            type="button"
            onClick={refreshLogs}
            disabled={logsQuery.isFetching}
            className="tap-target inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-white/75 px-3 text-xs font-bold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98] disabled:opacity-55"
          >
            <RefreshCw className={`h-4 w-4 ${logsQuery.isFetching ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FilterSelect
            id="operator-audit-action-filter"
            label="操作类型"
            value={filters.action}
            options={actionFilterOptions}
            open={openFilter === 'action'}
            onOpenChange={(open) => setOpenFilter(open ? 'action' : null)}
            onChange={(action) => setFilters((current) => ({ ...current, action }))}
          />

          <FilterSelect
            id="operator-audit-status-filter"
            label="执行结果"
            value={filters.status}
            options={statusFilterOptions}
            open={openFilter === 'status'}
            onOpenChange={(open) => setOpenFilter(open ? 'status' : null)}
            onChange={(status) => setFilters((current) => ({ ...current, status }))}
          />

          <TextFilter
            label="目标类型"
            value={filters.targetType}
            placeholder="例如 OUTBOX_EVENT"
            onChange={(targetType) => setFilters((current) => ({ ...current, targetType }))}
          />
          <TextFilter
            label="目标 ID"
            value={filters.targetId}
            placeholder="输入 outbox event id"
            onChange={(targetId) => setFilters((current) => ({ ...current, targetId }))}
          />
          <TextFilter
            label="操作者 ID"
            value={filters.actorUserId}
            placeholder="输入管理员 userId"
            onChange={(actorUserId) => setFilters((current) => ({ ...current, actorUserId }))}
          />

          <div className="grid grid-cols-2 gap-2 self-end">
            <button
              type="button"
              onClick={applyFilters}
              className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-3 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
            >
              <Search className="h-4 w-4" />
              查询
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!activeFilters && !hasDraftFilters}
              className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/75 px-3 text-sm font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98] disabled:opacity-45"
            >
              <X className="h-4 w-4" />
              清空
            </button>
          </div>
        </div>

        <p className="mt-3 rounded-2xl bg-white/65 px-3 py-2 text-xs leading-5 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
          页面不会展示 payload、用户正文、prompt、RAG chunk、token、cookie 或 API key。真正权限仍由后端 OperatorGuard 控制。
        </p>
      </section>

      {logsQuery.isError ? (
        <ErrorState onRetry={() => void logsQuery.refetch()} />
      ) : isFirstPageLoading ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <EmptyState activeFilters={activeFilters} />
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4 text-[#247269]" />
              最近记录
            </div>
            <span className="text-xs text-[var(--pm-muted)]">每页 {pageLimit} 条</span>
          </div>

          {items.map((item) => (
            <AuditLogCard key={item.id} item={item} />
          ))}

          {logsQuery.data?.nextCursor ? (
            <button
              type="button"
              onClick={() => setCursor(logsQuery.data?.nextCursor ?? null)}
              disabled={logsQuery.isFetching}
              className="tap-target flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white/80 px-4 text-sm font-semibold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98] disabled:opacity-55"
            >
              <RotateCcw className={`h-4 w-4 ${logsQuery.isFetching ? 'animate-spin' : ''}`} />
              下一页
            </button>
          ) : null}
        </section>
      )}
    </Shell>
  );
}

function Shell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/profile"
            aria-label="返回个人中心"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">{subtitle}</p>
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">
              管理员手动访问，不进入普通导航
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
            {icon}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}

function NoPermissionState() {
  return (
    <Shell title="操作审计" subtitle="Operator audit" icon={<LockKeyhole className="h-5 w-5" />}>
      <section className="pm-glass-card pm-enter rounded-[1.5rem] p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#fff7df] text-[#86621f] ring-1 ring-[#f3dfaa]">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-base font-semibold">当前账号没有操作审计权限</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--pm-muted)]">
          这个页面只给管理员排障使用。普通学习账号不会读取审计列表，后端也会再次校验管理员身份。
        </p>
        <Link
          href="/profile"
          className="tap-target mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
        >
          返回个人中心
        </Link>
      </section>
    </Shell>
  );
}

function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  open,
  onOpenChange,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: Array<FilterSelectOption<T>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const listboxId = `${id}-listbox`;

  function closeWhenFocusLeaves(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      onOpenChange(false);
    }
  }

  return (
    <div className="relative" onBlur={closeWhenFocusLeaves}>
      <span id={`${id}-label`} className="text-xs font-semibold text-[var(--pm-muted)]">
        {label}
      </span>
      <button
        type="button"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => onOpenChange(!open)}
        className="tap-target mt-1 grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-white/70 bg-white/82 px-3 text-left text-sm font-semibold text-[var(--pm-ink)] shadow-[0_10px_28px_rgba(36,60,80,0.07)] outline-none ring-1 ring-[var(--pm-line)] transition-all hover:bg-white focus:border-[#66cfc1] focus:ring-4 focus:ring-[#d8f8f0] active:scale-[0.99]"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4fbf9] text-[#247269] ring-1 ring-[#d8eee9]">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_18px_50px_rgba(24,38,53,0.16)] ring-1 ring-[var(--pm-line)] backdrop-blur-xl"
        >
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value || 'all'}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(false);
                }}
                className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm transition-all ${
                  selected
                    ? 'bg-[#eafff9] font-semibold text-[#1f6f66]'
                    : 'text-[var(--pm-ink)] hover:bg-[#f7faf9]'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TextFilter({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[var(--pm-muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-2xl border border-[var(--pm-line)] bg-white/80 px-3 text-sm font-semibold outline-none transition-all placeholder:text-[var(--pm-muted)] focus:border-[#6fcbbf] focus:ring-4 focus:ring-[#d8f8f0]"
      />
    </label>
  );
}

function AuditLogCard({ item }: { item: OperatorAuditLogListItem }) {
  const tone = getOperatorAuditStatusTone(item.status);
  const statusClassName =
    tone === 'success'
      ? 'bg-[#effdf9] text-[#247269] ring-[#bdeee5]'
      : 'bg-red-50 text-red-700 ring-red-100';
  const StatusIcon = tone === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <article className="pm-glass-card pm-enter rounded-[1.35rem] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-[#315f86] ring-1 ring-[var(--pm-line)]">
          <Database className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{getOperatorAuditActionLabel(item.action)}</h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${statusClassName}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {getOperatorAuditStatusLabel(item.status)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--pm-muted)]">{item.id}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <MiniField icon={<Clock3 className="h-4 w-4" />} label="时间" value={formatOperatorAuditDateTime(item.createdAt)} />
        <MiniField icon={<UserRound className="h-4 w-4" />} label="操作者" value={item.actorUserId ?? '未知'} />
        <MiniField icon={<Hash className="h-4 w-4" />} label="目标类型" value={item.targetType} />
        <MiniField icon={<Fingerprint className="h-4 w-4" />} label="目标 ID" value={item.targetId ?? '无'} />
      </div>

      {item.reason || item.requestId ? (
        <div className="mt-3 rounded-2xl bg-white/65 p-3 text-xs leading-5 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
          {item.reason ? <p className="break-words">原因：{item.reason}</p> : null}
          {item.requestId ? <p className="mt-1 break-all">Request ID：{item.requestId}</p> : null}
        </div>
      ) : null}

      {item.errorCode || item.errorPreview ? (
        <div className="mt-3 rounded-2xl bg-red-50/80 p-3 text-xs leading-5 text-red-700 ring-1 ring-red-100">
          {item.errorCode ? <p className="font-semibold">错误码：{item.errorCode}</p> : null}
          {item.errorPreview ? <p className="mt-1 break-words">{item.errorPreview}</p> : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-[var(--pm-muted)] sm:grid-cols-2">
        <span className="truncate rounded-2xl bg-white/55 px-2 py-1 ring-1 ring-[var(--pm-line)]">
          IP hash：{item.ipAddressHash ?? '无'}
        </span>
        <span className="truncate rounded-2xl bg-white/55 px-2 py-1 ring-1 ring-[var(--pm-line)]">
          UA hash：{item.userAgentHash ?? '无'}
        </span>
      </div>
    </article>
  );
}

function MiniField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/65 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--pm-muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate font-semibold text-[var(--pm-ink)]">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-36 animate-pulse rounded-[1.35rem] bg-white/60 ring-1 ring-[var(--pm-line)]"
        />
      ))}
    </div>
  );
}

function EmptyState({ activeFilters }: { activeFilters: boolean }) {
  return (
    <section className="pm-glass-card pm-enter rounded-[1.5rem] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#effdf9] text-[#247269] ring-1 ring-[#bdeee5]">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">
        {activeFilters ? '没有匹配的审计记录' : '暂无审计记录'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--pm-muted)]">
        {activeFilters
          ? '可以放宽筛选条件再查一次。'
          : '当管理员执行 Outbox requeue 等受控操作后，这里会出现脱敏审计记录。'}
      </p>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl bg-red-50/85 px-4 py-4 text-sm leading-6 text-red-700 ring-1 ring-red-100">
      <p className="font-semibold">操作审计读取失败，请确认后端开关和管理员权限。</p>
      <button
        type="button"
        onClick={onRetry}
        className="tap-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-red-700 ring-1 ring-red-100 transition-all hover:bg-red-50 active:scale-[0.98]"
      >
        <RefreshCw className="h-4 w-4" />
        重新读取
      </button>
    </section>
  );
}

function normalizeFilters(filters: FilterFormState): Partial<OperatorAuditLogListQuery> {
  return {
    action: filters.action || undefined,
    status: filters.status || undefined,
    targetType: filters.targetType.trim() || undefined,
    targetId: filters.targetId.trim() || undefined,
    actorUserId: filters.actorUserId.trim() || undefined,
  };
}
