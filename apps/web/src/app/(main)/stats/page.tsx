'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { ReviewStatsRange } from '@repo/types/api/review';

import { useReviewLogs, useReviewStats } from '@/hooks/use-reviews';
import {
  formatPercent,
  getMaxDailyReviewCount,
  getRatingLabel,
  getStateLabel,
  shouldShowStatsEmptyState,
} from '@/lib/review-stats-view';
import { getLocalDateKey } from '@/lib/today-tasks';

const pageSize = 20;

export default function StatsPage() {
  const [range, setRange] = useState<ReviewStatsRange>('7d');
  const [page, setPage] = useState(1);
  const endDate = useMemo(() => getLocalDateKey(), []);
  const timezoneOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const statsQuery = useReviewStats({ range, endDate, timezoneOffsetMinutes });
  const logsQuery = useReviewLogs({ page, pageSize });
  const stats = statsQuery.data;
  const logs = logsQuery.data;
  const maxDailyCount = getMaxDailyReviewCount(stats?.dailyReviews ?? []);
  const empty = shouldShowStatsEmptyState(stats?.totalReviews ?? 0, logs?.total ?? 0);
  const hasNextPage = logs ? page * logs.pageSize < logs.total : false;

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/chat"
            aria-label="返回聊天"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">Learning stats</p>
            <h1 className="text-lg font-semibold leading-tight">学习统计</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">
              看看最近的复习节奏和掌握状态
            </p>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        <section className="pm-glass-card pm-enter rounded-[1.6rem] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--pm-muted)]">复习成果</p>
              <p className="mt-1 text-3xl font-black leading-none text-[var(--pm-ink)]">
                {stats?.totalReviews ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--pm-muted)]">窗口内复习次数</p>
            </div>
            <div className="flex rounded-2xl bg-white/70 p-1 ring-1 ring-[var(--pm-line)]">
              {(['7d', '30d'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setRange(item);
                    setPage(1);
                  }}
                  className={`tap-target min-h-9 rounded-xl px-3 text-xs font-bold transition-all ${
                    range === item
                      ? 'bg-[#2b2335] text-white'
                      : 'text-[var(--pm-muted)] hover:bg-white'
                  }`}
                >
                  {item === '7d' ? '7 天' : '30 天'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStat label="掌握率" value={formatPercent(stats?.accuracyLikeRate ?? 0)} />
            <MiniStat label="连续复习" value={`${stats?.streakDays ?? 0} 天`} />
            <MiniStat label="复习卡" value={`${stats?.reviewedCards ?? 0} 张`} />
            <MiniStat label="当前待复习" value={`${stats?.dueCards ?? 0} 张`} />
          </div>
        </section>

        {statsQuery.isLoading || logsQuery.isLoading ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取学习统计...
          </div>
        ) : statsQuery.isError || logsQuery.isError ? (
          <div className="mt-4 rounded-2xl bg-red-50/85 px-3 py-3 text-sm leading-6 text-red-600 ring-1 ring-red-100">
            <p>统计数据读取失败，请稍后刷新重试。</p>
            <button
              type="button"
              onClick={() => {
                void statsQuery.refetch();
                void logsQuery.refetch();
              }}
              className="tap-target mt-2 inline-flex min-h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-bold text-red-600 ring-1 ring-red-100"
            >
              重新读取
            </button>
          </div>
        ) : empty ? (
          <EmptyStats />
        ) : (
          <>
            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle
                icon={CalendarDays}
                title="复习趋势"
                subtitle={`${stats?.fromDate} 到 ${stats?.toDate}`}
              />
              <div className="mt-4 flex h-32 items-end gap-1.5">
                {(stats?.dailyReviews ?? []).map((item) => (
                  <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end rounded-full bg-white/55 ring-1 ring-[var(--pm-line)]">
                      <div
                        className="w-full rounded-full bg-gradient-to-t from-[#78d6c8] to-[#ffe89a]"
                        style={{ height: `${Math.max(6, (item.count / maxDailyCount) * 100)}%` }}
                        title={`${item.date}: ${item.count}`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--pm-muted)]">
                      {item.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle
                icon={Sparkles}
                title="评分分布"
                subtitle="四档反馈会影响下次复习时间"
              />
              <div className="mt-3 space-y-2">
                {([
                  [1, stats?.ratingCounts.again ?? 0],
                  [2, stats?.ratingCounts.hard ?? 0],
                  [3, stats?.ratingCounts.good ?? 0],
                  [4, stats?.ratingCounts.easy ?? 0],
                ] as const).map(([rating, count]) => (
                  <DistributionRow
                    key={rating}
                    label={getRatingLabel(rating)}
                    value={count}
                    total={stats?.totalReviews ?? 0}
                  />
                ))}
              </div>
            </section>

            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle icon={BookOpen} title="卡片状态" subtitle="当前复习卡分布" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'] as const).map((state) => (
                  <MiniStat
                    key={state}
                    label={getStateLabel(state)}
                    value={`${stats?.stateCounts[state] ?? 0} 张`}
                  />
                ))}
              </div>
            </section>

            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle icon={History} title="最近复习" subtitle={`${logs?.total ?? 0} 条记录`} />
              <div className="mt-3 space-y-3">
                {(logs?.items ?? []).map((item) => (
                  <article key={item.id} className="rounded-2xl bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#eafff9] px-2 py-0.5 text-[11px] font-bold text-[#247269]">
                        {getRatingLabel(item.rating)}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--pm-muted)]">
                        {formatDateTime(item.reviewedAt)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6">
                      {item.wrongQuestion?.questionText ?? '复习卡'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--pm-muted)]">
                      下次复习：{formatDateTime(item.nextReview)}
                    </p>
                  </article>
                ))}
              </div>

              {logs && logs.total > logs.pageSize ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || logsQuery.isFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="tap-target inline-flex min-h-10 items-center gap-1 rounded-2xl bg-white/75 px-3 text-xs font-bold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] disabled:opacity-45"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </button>
                  <span className="text-xs font-semibold text-[var(--pm-muted)]">
                    第 {logs.page} 页
                  </span>
                  <button
                    type="button"
                    disabled={!hasNextPage || logsQuery.isFetching}
                    onClick={() => setPage((current) => current + 1)}
                    className="tap-target inline-flex min-h-10 items-center gap-1 rounded-2xl bg-white/75 px-3 text-xs font-bold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] disabled:opacity-45"
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <p className="text-xs font-medium text-[var(--pm-muted)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--pm-ink)]">{value}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-[var(--pm-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function DistributionRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        <span className="text-[var(--pm-muted)]">{value} 次</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-[var(--pm-line)]">
        <div className="h-full rounded-full bg-[#78d6c8]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function EmptyStats() {
  return (
    <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <RotateCcw className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">还没有复习统计</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
        从错题详情加入复习计划，并在今日任务里完成一次评分后，这里会出现趋势和记录。
      </p>
      <Link
        href="/today"
        className="tap-target mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white"
      >
        去今日任务
      </Link>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
