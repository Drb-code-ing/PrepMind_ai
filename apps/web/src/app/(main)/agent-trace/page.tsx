'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AgentTraceRun, AgentTraceStep } from '@repo/types/api/agent-trace';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  Cpu,
  DatabaseZap,
  Loader2,
  RefreshCw,
  Route,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import {
  useAgentTraceDetail,
  useAgentTraceRuns,
  useAgentTraceSummary,
} from '@/hooks/use-agent-traces';
import { useDevAiModeStatus, useSetDevAiMode } from '@/hooks/use-dev-ai-mode';
import {
  formatAgentTraceCost,
  formatAgentTraceDateTime,
  formatAgentTraceDuration,
  formatAgentTracePricingStatus,
  getAgentTraceModeClassName,
  getAgentTraceModeLabel,
  getAgentTraceRouteLabel,
  getAgentTraceStatusClassName,
  getAgentTraceStatusLabel,
  getAgentTraceVerifierStatusLabel,
} from '@/lib/agent-trace-view';

const summaryDays = 7;
const runsLimit = 20;

export default function AgentTracePage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const summaryQuery = useAgentTraceSummary(summaryDays);
  const runsQuery = useAgentTraceRuns(runsLimit);
  const detailQuery = useAgentTraceDetail(selectedRunId);
  const devAiModeQuery = useDevAiModeStatus();
  const setDevAiModeMutation = useSetDevAiMode();
  const runs = runsQuery.data?.runs ?? [];
  const selectedDetail = detailQuery.data;
  const degradedOrFailed =
    (summaryQuery.data?.degradedRuns ?? 0) + (summaryQuery.data?.failedRuns ?? 0);
  const isInitialLoading = summaryQuery.isLoading || runsQuery.isLoading;
  const hasError = summaryQuery.isError || runsQuery.isError;

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
            <p className="text-xs font-medium text-[var(--pm-muted)]">Agent observability</p>
            <h1 className="text-lg font-semibold leading-tight">Agent 调试台</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">
              路由、降级、RAG 核对与估算成本
            </p>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
            <Activity className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--pm-muted)]">
                最近 {summaryDays} 天
              </p>
              <h2 className="mt-1 text-base font-semibold">Trace 摘要</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                void summaryQuery.refetch();
                void runsQuery.refetch();
              }}
              className="tap-target inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-white/75 px-3 text-xs font-bold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile
              label="总调用"
              value={String(summaryQuery.data?.totalRuns ?? 0)}
              icon={Route}
            />
            <SummaryTile
              label="Live"
              value={String(summaryQuery.data?.liveRuns ?? 0)}
              icon={DatabaseZap}
            />
            <SummaryTile
              label="估算成本"
              value={formatAgentTraceCost(summaryQuery.data?.totalCostEstimate ?? 0)}
              icon={Clock3}
            />
            <SummaryTile
              label="降级/失败"
              value={String(degradedOrFailed)}
              icon={AlertTriangle}
            />
          </div>
        </section>

        <DevAiModeSwitch
          status={devAiModeQuery.data}
          loading={devAiModeQuery.isLoading}
          pending={setDevAiModeMutation.isPending}
          statusError={
            devAiModeQuery.error instanceof Error ? devAiModeQuery.error.message : null
          }
          error={
            setDevAiModeMutation.error instanceof Error
              ? setDevAiModeMutation.error.message
              : null
          }
          onSelect={(mode) => setDevAiModeMutation.mutate(mode)}
        />

        {isInitialLoading ? (
          <LoadingSkeleton />
        ) : hasError ? (
          <section className="rounded-2xl bg-red-50/85 px-4 py-4 text-sm leading-6 text-red-600 ring-1 ring-red-100">
            <p className="font-semibold">Agent Trace 加载失败，请稍后重试。</p>
            <button
              type="button"
              onClick={() => {
                void summaryQuery.refetch();
                void runsQuery.refetch();
              }}
              className="tap-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-red-600 ring-1 ring-red-100 transition-all hover:bg-red-50 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              重新读取
            </button>
          </section>
        ) : runs.length === 0 ? (
          <EmptyTrace />
        ) : (
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">最近 Trace</h2>
              <span className="text-xs text-[var(--pm-muted)]">最多 {runsLimit} 条</span>
            </div>
            <div className="space-y-3">
              {runs.map((run) => (
                <TraceRunItem
                  key={run.id}
                  run={run}
                  selected={run.id === selectedRunId}
                  steps={run.id === selectedRunId ? selectedDetail?.steps : undefined}
                  detailLoading={run.id === selectedRunId && detailQuery.isLoading}
                  detailError={run.id === selectedRunId && detailQuery.isError}
                  onToggle={() =>
                    setSelectedRunId((current) => (current === run.id ? null : run.id))
                  }
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function DevAiModeSwitch({
  status,
  loading,
  pending,
  statusError,
  error,
  onSelect,
}: {
  status?: {
    enabled: boolean;
    activeMode: 'mock' | 'live';
    liveAllowedByEnv: boolean;
    message: string | null;
  };
  loading: boolean;
  pending: boolean;
  statusError: string | null;
  error: string | null;
  onSelect: (mode: 'mock' | 'live') => void;
}) {
  if (loading) return null;

  if (!status?.enabled) {
    return statusError ? (
      <section className="pm-enter rounded-[1.35rem] bg-red-50/85 p-3 text-sm leading-6 text-red-600 ring-1 ring-red-100">
        AI 模式状态读取失败：{statusError}
      </section>
    ) : null;
  }

  const liveDisabled = pending || !status.liveAllowedByEnv;
  const mockActive = status.activeMode === 'mock';
  const liveActive = status.activeMode === 'live';

  return (
    <section className="pm-enter rounded-[1.35rem] bg-white/72 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff7df] text-[#86621f] ring-1 ring-[#f3dfaa]">
            <Cpu className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">AI 模式</p>
            <p className="mt-0.5 truncate text-xs text-[var(--pm-muted)]">
              当前：{status.activeMode === 'live' ? 'Live' : 'Mock'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:w-56">
          <button
            type="button"
            onClick={() => onSelect('mock')}
            disabled={pending || mockActive}
            className={`tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold ring-1 transition-all active:scale-[0.98] ${
              mockActive
                ? 'bg-[#2b2335] text-white ring-[#2b2335]'
                : 'bg-white/80 text-[var(--pm-ink)] ring-[var(--pm-line)] hover:bg-white'
            }`}
          >
            <Cpu className="h-4 w-4" />
            Mock
          </button>
          <button
            type="button"
            onClick={() => onSelect('live')}
            disabled={liveDisabled || liveActive}
            className={`tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold ring-1 transition-all active:scale-[0.98] ${
              liveActive
                ? 'bg-[#1f6f62] text-white ring-[#1f6f62]'
                : 'bg-white/80 text-[var(--pm-ink)] ring-[var(--pm-line)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45'
            }`}
          >
            <Zap className="h-4 w-4" />
            Live
          </button>
        </div>
      </div>

      {!status.liveAllowedByEnv && status.message ? (
        <p className="mt-3 rounded-2xl bg-amber-50/85 px-3 py-2 text-xs leading-5 text-amber-700 ring-1 ring-amber-100">
          {status.message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-2xl bg-red-50/85 px-3 py-2 text-xs leading-5 text-red-600 ring-1 ring-red-100">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="min-h-24 rounded-2xl bg-white/65 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--pm-muted)]">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-3 break-all text-2xl font-black leading-none text-[var(--pm-ink)]">
        {value}
      </p>
    </div>
  );
}

function TraceRunItem({
  run,
  selected,
  steps,
  detailLoading,
  detailError,
  onToggle,
}: {
  run: AgentTraceRun;
  selected: boolean;
  steps?: AgentTraceStep[];
  detailLoading: boolean;
  detailError: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="pm-enter rounded-[1.35rem] bg-white/72 p-3 ring-1 ring-[var(--pm-line)]">
      <button
        type="button"
        onClick={onToggle}
        className="tap-target flex min-h-11 w-full items-start gap-3 text-left"
        aria-expanded={selected}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
          <Route className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{getAgentTraceRouteLabel(run.route)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getAgentTraceModeClassName(run.mode)}`}
            >
              {getAgentTraceModeLabel(run.mode)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getAgentTraceStatusClassName(run.status)}`}
            >
              {getAgentTraceStatusLabel(run.status)}
            </span>
          </span>
          <span className="mt-1 block truncate text-xs text-[var(--pm-muted)]">
            {run.modelProvider} / {run.modelName}
          </span>
          <span className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold text-[var(--pm-muted)] sm:grid-cols-4">
            <Metric label="输入" value={`${run.inputTokenEstimate}`} />
            <Metric label="输出" value={`${run.outputTokenEstimate}`} />
            <Metric
              label="成本"
              value={
                run.pricingKnown
                  ? formatAgentTraceCost(run.costEstimate)
                  : `${formatAgentTraceCost(run.costEstimate)} · ${formatAgentTracePricingStatus(false)}`
              }
            />
            <Metric label="耗时" value={formatAgentTraceDuration(run.totalDurationMs)} />
          </span>
          <span className="mt-2 block text-[11px] font-medium text-[var(--pm-muted)]">
            {formatAgentTraceDateTime(run.createdAt)}
          </span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/75 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
          {selected ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {selected ? (
        <div className="mt-3 border-t border-[var(--pm-line)] pt-3">
          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-[var(--pm-muted)] sm:grid-cols-4">
            <Metric label="RAG 命中" value={`${run.ragHitCount}`} />
            <Metric
              label="核对"
              value={getAgentTraceVerifierStatusLabel(run.verifierStatus)}
            />
            <Metric label="核对片段" value={`${run.verifierChunkCount}`} />
            <Metric label="Tutor" value={run.tutorIntent ?? '未执行'} />
          </div>

          {detailLoading ? (
            <div className="mt-3 flex min-h-16 items-center gap-2 rounded-2xl bg-white/70 px-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在读取步骤...
            </div>
          ) : detailError ? (
            <div className="mt-3 rounded-2xl bg-red-50/85 px-3 py-3 text-sm text-red-600 ring-1 ring-red-100">
              Trace 详情读取失败，请稍后重试。
            </div>
          ) : steps?.length ? (
            <div className="mt-3 space-y-2">
              {steps.map((step) => (
                <TraceStepItem key={step.id} step={step} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function TraceStepItem({ step }: { step: AgentTraceStep }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#247269]" />
          <span className="text-sm font-semibold">{step.node}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getAgentTraceStatusClassName(step.status)}`}
        >
          {getAgentTraceStatusLabel(step.status)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--pm-muted)]">
        输入：{step.inputSummary || '无摘要'}
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
        输出：{step.outputSummary || '无摘要'}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-[var(--pm-muted)]">
        {formatAgentTraceDuration(step.durationMs)}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 rounded-2xl bg-white/65 px-2 py-1 ring-1 ring-[var(--pm-line)]">
      <span className="block truncate">{label}</span>
      <span className="mt-0.5 block truncate text-[var(--pm-ink)]">{value}</span>
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-[1.35rem] bg-white/60 ring-1 ring-[var(--pm-line)]"
        />
      ))}
    </div>
  );
}

function EmptyTrace() {
  return (
    <section className="pm-glass-card pm-enter rounded-[1.5rem] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <Activity className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">暂无 Agent Trace</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
        登录后在 Chat 里发起一次对话，系统会尽力记录路由、降级和估算成本元数据。
      </p>
      <Link
        href="/chat"
        className="tap-target mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
      >
        去 Chat
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
