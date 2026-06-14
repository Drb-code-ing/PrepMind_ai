'use client';

import { Check, Circle, Save } from 'lucide-react';
import type { OcrQuestionResult } from '@repo/types/api/ocr-question';

import { cn } from '@/lib/utils';

type OcrQuestionListProps = {
  questions: OcrQuestionResult[];
  selectedQuestionId?: string;
  selectedForBatch: Set<string>;
  savedQuestionIds: Set<string>;
  onSelectQuestion: (questionId: string) => void;
  onToggleBatch: (questionId: string) => void;
  onSaveQuestion: (questionId: string) => void;
  onSaveSelected: () => void;
};

export function OcrQuestionList({
  questions,
  selectedQuestionId,
  selectedForBatch,
  savedQuestionIds,
  onSelectQuestion,
  onToggleBatch,
  onSaveQuestion,
  onSaveSelected,
}: OcrQuestionListProps) {
  const batchCount = selectedForBatch.size;

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-[var(--pm-line)] bg-white/72 p-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold text-[var(--pm-ink)]">
          已识别 {questions.length} 道题
        </p>
        <button
          type="button"
          disabled={batchCount === 0}
          onClick={onSaveSelected}
          className="min-h-9 rounded-full bg-[#2b2335] px-3 text-xs font-semibold text-white transition active:scale-95 disabled:bg-[var(--pm-line)] disabled:text-[var(--pm-muted)] disabled:active:scale-100"
        >
          保存所选{batchCount > 0 ? ` ${batchCount}` : ''}
        </button>
      </div>

      {questions.map((question) => {
        const isSelected = selectedQuestionId === question.id;
        const isBatchSelected = selectedForBatch.has(question.id);
        const isSaved = savedQuestionIds.has(question.id);
        const canSave =
          question.saveStatus === 'savable' || question.saveStatus === 'needs_review';

        return (
          <article
            key={question.id}
            className={cn(
              'rounded-2xl border bg-white/86 p-3 text-xs shadow-sm transition',
              isSelected ? 'border-[#79d3c5] ring-2 ring-[#d8f8f0]' : 'border-[var(--pm-line)]',
            )}
          >
            <button
              type="button"
              onClick={() => onSelectQuestion(question.id)}
              className="block min-h-11 w-full text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--pm-ink)]">
                    第 {question.index} 题 · {question.subject}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[var(--pm-muted)]">
                    {question.questionText || '题干暂未识别完整'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#eafff9] px-2 py-1 text-[11px] font-semibold text-[#247269]">
                  {question.saveStatus === 'savable'
                    ? '可保存'
                    : question.saveStatus === 'needs_review'
                      ? '需检查'
                      : '不可保存'}
                </span>
              </div>
            </button>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canSave || isSaved}
                onClick={() => onToggleBatch(question.id)}
                className="flex min-h-9 items-center gap-1 rounded-full border border-[var(--pm-line)] px-2.5 font-medium text-[var(--pm-muted)] transition active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {isBatchSelected ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                选择
              </button>
              <button
                type="button"
                disabled={!canSave || isSaved}
                onClick={() => onSaveQuestion(question.id)}
                className="flex min-h-9 items-center gap-1 rounded-full bg-[#eafff9] px-2.5 font-semibold text-[#247269] transition active:scale-95 disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:active:scale-100"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaved ? '已保存' : '保存'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
