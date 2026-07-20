'use client';

import Link from 'next/link';
import type { ReviewAgentSuggestionResponse } from '@repo/types/api/review-agent';
import { Brain, ChevronRight, Sparkles } from 'lucide-react';

import {
  getReviewAgentPriorityMeta,
  getReviewAgentShortTodayText,
} from '@/lib/review-agent-view';
import {
  getReviewPlannerModelStatus,
  reviewPlannerModelStatusLabels,
} from '@/lib/review-agent-model-status';

type ReviewAgentSuggestionCardProps = {
  suggestion: ReviewAgentSuggestionResponse;
  compact?: boolean;
};

export function ReviewAgentSuggestionCard({
  suggestion,
  compact = false,
}: ReviewAgentSuggestionCardProps) {
  const priority = getReviewAgentPriorityMeta(suggestion.review.priority);
  const firstBlock = suggestion.planner.suggestedBlocks[0];
  const actionHref = firstBlock ? normalizeSuggestionHref(firstBlock.targetHref) : '/today';
  const weakPoints = suggestion.review.weakPoints.slice(0, 3);
  const todayText = getReviewAgentShortTodayText(suggestion.planner);
  const modelStatus = getReviewPlannerModelStatus(suggestion.modelObservations);

  return (
    <section className="pm-glass-card pm-enter overflow-hidden rounded-[1.5rem] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
          <Brain className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Agent 学习建议</h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${priority.className}`}
            >
              {priority.label}
            </span>
          </div>

          <p className="mt-2 break-words text-sm font-bold leading-6 text-[var(--pm-ink)]">
            {suggestion.planner.headline}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-[var(--pm-muted)]">
            {compact ? todayText : suggestion.planner.todayFocus}
          </p>

          {!compact ? (
            <p className="mt-1 break-words text-xs leading-5 text-[var(--pm-muted)]">
              {suggestion.planner.weekStrategy}
            </p>
          ) : null}

          {suggestion.planner.capacityNotice ? (
            <p className="mt-3 break-words rounded-2xl bg-[#fff7df] px-3 py-2 text-xs font-semibold leading-5 text-[#8a6815] ring-1 ring-[#f3e6a8]">
              {suggestion.planner.capacityNotice}
            </p>
          ) : null}

          {modelStatus ? (
            <p
              className={`mt-3 break-words rounded-2xl px-3 py-2 text-xs font-semibold leading-5 ring-1 ${
                modelStatus === 'applied'
                  ? 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]'
                  : 'bg-[#fff7df] text-[#8a6815] ring-[#f3e6a8]'
              }`}
            >
              {reviewPlannerModelStatusLabels[modelStatus]}
            </p>
          ) : null}

          {!compact && weakPoints.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {weakPoints.map((point) => (
                <span
                  key={point.label}
                  className="max-w-full break-words rounded-full bg-[#eafff9] px-2 py-1 text-[11px] font-semibold text-[#247269] ring-1 ring-[#bdeee5]"
                >
                  {point.label}
                </span>
              ))}
            </div>
          ) : null}

          {firstBlock ? (
            <Link
              href={actionHref}
              className="tap-target mt-3 inline-flex min-h-11 max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              <span className="break-words">{firstBlock.title}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function normalizeSuggestionHref(href: string) {
  const trimmed = href.trim();
  return trimmed.startsWith('/') && !trimmed.startsWith('//') ? trimmed : '/today';
}
