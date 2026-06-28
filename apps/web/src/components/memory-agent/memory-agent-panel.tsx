'use client';

import { useState } from 'react';
import type {
  MemoryCandidate,
  UserMemory,
  UserMemoryStatus,
  UserMemoryType,
} from '@repo/types/api/memory-agent';
import {
  Archive,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import {
  useAcceptMemoryCandidate,
  useDeleteUserMemory,
  useGenerateMemoryCandidates,
  useMemoryCandidates,
  useRejectMemoryCandidate,
  useUpdateUserMemory,
  useUserMemories,
} from '@/hooks/use-memory-agent';

type MemoryAgentPanelProps = {
  userId: string;
};

const memoryTypeLabels: Record<UserMemoryType, string> = {
  LEARNING_GOAL: '学习目标',
  EXPLANATION_PREFERENCE: '讲解偏好',
  WEAK_POINT: '薄弱点',
  STUDY_HABIT: '学习习惯',
};

export function MemoryAgentPanel({ userId }: MemoryAgentPanelProps) {
  const [memoryStatusFilter, setMemoryStatusFilter] =
    useState<Extract<UserMemoryStatus, 'ACTIVE' | 'ARCHIVED'>>('ACTIVE');
  const [confirmDeleteMemoryId, setConfirmDeleteMemoryId] = useState<string | null>(null);
  const candidates = useMemoryCandidates(userId, { status: 'PENDING', limit: 20 });
  const memories = useUserMemories(userId, { status: memoryStatusFilter });
  const generateCandidates = useGenerateMemoryCandidates(userId);
  const acceptCandidate = useAcceptMemoryCandidate(userId);
  const rejectCandidate = useRejectMemoryCandidate(userId);
  const updateMemory = useUpdateUserMemory(userId);
  const deleteMemory = useDeleteUserMemory(userId);
  const busy =
    generateCandidates.isPending ||
    acceptCandidate.isPending ||
    rejectCandidate.isPending ||
    updateMemory.isPending ||
    deleteMemory.isPending;

  async function handleGenerate() {
    await generateCandidates.mutateAsync({ source: 'profile', force: false });
  }

  async function handleArchive(memory: UserMemory) {
    setConfirmDeleteMemoryId(null);
    await updateMemory.mutateAsync({
      memoryId: memory.id,
      input: {
        status: memory.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE',
      },
    });
  }

  async function handleDelete(memoryId: string) {
    await deleteMemory.mutateAsync(memoryId);
    setConfirmDeleteMemoryId(null);
  }

  return (
    <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#247269]" />
            <h2 className="text-base font-semibold">长期记忆</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
            第一版不会自动把这些记忆用于每次对话，后续会增加个性化开关。
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!userId || generateCandidates.isPending}
          className="tap-target inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3a3047] active:scale-95 disabled:opacity-50"
        >
          {generateCandidates.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          生成候选
        </button>
      </div>

      {generateCandidates.data?.summary ? (
        <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-sm font-medium text-emerald-700">
          {generateCandidates.data.summary}
        </p>
      ) : null}

      {generateCandidates.isError ||
      acceptCandidate.isError ||
      rejectCandidate.isError ||
      updateMemory.isError ||
      deleteMemory.isError ? (
        <p className="mt-3 rounded-2xl border border-red-100 bg-red-50/80 px-3 py-2 text-sm font-medium text-red-700">
          记忆操作失败，请稍后重试。
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        <section className="rounded-2xl border border-[var(--pm-line)] bg-white/65 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">建议记住</h3>
            <span className="rounded-full bg-[#effdf9] px-2 py-1 text-xs font-semibold text-[#347d70]">
              {candidates.data?.items.length ?? 0}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {candidates.isLoading ? <MemorySkeleton /> : null}
            {candidates.isError ? (
              <ErrorRow text="候选加载失败，请稍后重试" onRetry={() => void candidates.refetch()} />
            ) : null}
            {!candidates.isLoading && !candidates.isError && candidates.data?.items.length === 0 ? (
              <EmptyRow text="暂无新的记忆候选" />
            ) : null}
            {candidates.data?.items.map((candidate) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                disabled={busy}
                onAccept={() => acceptCandidate.mutateAsync(candidate.id)}
                onReject={() => rejectCandidate.mutateAsync(candidate.id)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--pm-line)] bg-white/65 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">已确认记忆</h3>
            <div className="grid grid-cols-2 gap-2 sm:w-auto">
              {(['ACTIVE', 'ARCHIVED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setConfirmDeleteMemoryId(null);
                    setMemoryStatusFilter(status);
                  }}
                  className={`tap-target min-h-11 rounded-2xl px-3 text-xs font-semibold ring-1 transition-all active:scale-[0.99] ${
                    memoryStatusFilter === status
                      ? 'bg-[#fff7d6] text-[#725c24] ring-[#f3e6a8]'
                      : 'bg-white/75 text-[var(--pm-muted)] ring-[var(--pm-line)] hover:bg-white'
                  }`}
                >
                  {status === 'ACTIVE' ? '使用中' : '已停用'}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs font-medium text-[var(--pm-muted)]">
            当前 {memories.data?.items.length ?? 0} 条
          </p>

          <div className="mt-3 space-y-3">
            {memories.isLoading ? <MemorySkeleton /> : null}
            {memories.isError ? (
              <ErrorRow text="记忆加载失败，请稍后重试" onRetry={() => void memories.refetch()} />
            ) : null}
            {!memories.isLoading && !memories.isError && memories.data?.items.length === 0 ? (
              <EmptyRow text="还没有确认的长期记忆" />
            ) : null}
            {memories.data?.items.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                disabled={busy}
                confirmingDelete={confirmDeleteMemoryId === memory.id}
                onToggle={() => handleArchive(memory)}
                onRequestDelete={() => setConfirmDeleteMemoryId(memory.id)}
                onCancelDelete={() => setConfirmDeleteMemoryId(null)}
                onConfirmDelete={() => handleDelete(memory.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function CandidateRow({
  candidate,
  disabled,
  onAccept,
  onReject,
}: {
  candidate: MemoryCandidate;
  disabled: boolean;
  onAccept: () => Promise<unknown>;
  onReject: () => Promise<unknown>;
}) {
  return (
    <article className="rounded-2xl bg-white/75 p-3 ring-1 ring-[var(--pm-line)]">
      <MemoryMeta type={candidate.type} confidence={candidate.confidence} />
      <h4 className="mt-2 break-words text-sm font-semibold text-[var(--pm-ink)]">
        {candidate.title}
      </h4>
      <p className="mt-1 break-words text-sm leading-6 text-[var(--pm-muted)]">
        {candidate.content}
      </p>
      <p className="mt-2 break-words text-xs leading-5 text-[#64748b]">{candidate.reason}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onAccept}
          className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#86dccf] px-3 text-sm font-semibold text-[#173b37] transition-all hover:bg-[#70cfc1] active:scale-[0.99] disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          确认
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onReject}
          className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/85 px-3 text-sm font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.99] disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          忽略
        </button>
      </div>
    </article>
  );
}

function MemoryRow({
  memory,
  disabled,
  confirmingDelete,
  onToggle,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  memory: UserMemory;
  disabled: boolean;
  confirmingDelete: boolean;
  onToggle: () => Promise<unknown>;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<unknown>;
}) {
  const archived = memory.status === 'ARCHIVED';

  if (confirmingDelete) {
    return (
      <article className="rounded-2xl bg-white/75 p-3 ring-1 ring-red-100">
        <MemoryMeta type={memory.type} confidence={memory.confidence} archived={archived} />
        <h4 className="mt-2 break-words text-sm font-semibold text-[var(--pm-ink)]">
          {memory.title}
        </h4>
        <p className="mt-1 break-words text-sm leading-6 text-[var(--pm-muted)]">
          {memory.content}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancelDelete}
            className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/85 px-3 text-sm font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.99]"
          >
            <X className="h-4 w-4" />
            取消
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onConfirmDelete}
            className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.99] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            确认删除
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl bg-white/75 p-3 ring-1 ring-[var(--pm-line)]">
      <MemoryMeta type={memory.type} confidence={memory.confidence} archived={archived} />
      <h4 className="mt-2 break-words text-sm font-semibold text-[var(--pm-ink)]">
        {memory.title}
      </h4>
      <p className="mt-1 break-words text-sm leading-6 text-[var(--pm-muted)]">
        {memory.content}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/85 px-3 text-sm font-semibold text-[#247269] ring-1 ring-[#bdeee5] transition-all hover:bg-[#eafff9] active:scale-[0.99] disabled:opacity-50"
        >
          {archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {archived ? '恢复' : '停用'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onRequestDelete}
          className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition-all hover:bg-red-100 active:scale-[0.99] disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          删除
        </button>
      </div>
    </article>
  );
}

function MemoryMeta({
  type,
  confidence,
  archived = false,
}: {
  type: UserMemoryType;
  confidence: number;
  archived?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
      <span className="rounded-full bg-[#effdf9] px-2 py-1 text-[#347d70]">
        {memoryTypeLabels[type]}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
        {Math.round(confidence * 100)}%
      </span>
      {archived ? (
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-500">已停用</span>
      ) : null}
    </div>
  );
}

function MemorySkeleton() {
  return (
    <div className="rounded-2xl bg-white/75 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-2 h-4 w-full animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

function ErrorRow({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/80 p-3 text-sm text-red-700">
      <p className="font-medium">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="tap-target mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-3 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition-all hover:bg-red-100 active:scale-[0.99]"
      >
        重试
      </button>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-3 py-4 text-center text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
      {text}
    </div>
  );
}
