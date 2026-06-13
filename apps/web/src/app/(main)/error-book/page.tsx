'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Loader2, Trash2, X } from 'lucide-react';

import MarkdownRenderer from '@/components/markdown/markdown-renderer';
import { db } from '@/lib/db';
import type { WrongQuestionRecord, WrongQuestionStatus } from '@/lib/db';
import {
  getCrudSuccessMessage,
  getDeleteConfirmButtonClassName,
  getDeleteActionState,
  shouldForwardCrudNotice,
  type DeleteActionState,
} from '@/lib/crud-feedback';
import type { UpdateLocalWrongQuestionRequest } from '@/lib/wrong-question-api';
import { mergeWrongQuestionsFromServer } from '@/lib/server-cache-sync';
import {
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getMutationErrorMessage,
} from '@/lib/mutation-queue';
import { getWrongQuestionFocusId } from '@/lib/wrong-question-navigation';
import { formatOcrContentForDisplay } from '@/lib/wrong-question-parser';
import {
  useDeleteWrongQuestion,
  useUpdateWrongQuestion,
  useWrongQuestions,
} from '@/hooks/use-wrong-questions';
import { useUserStore } from '@/stores/userStore';
import { Textarea } from '@/components/ui/textarea';

type StatusFilter = 'all' | WrongQuestionStatus;
type ActionNotice = { message: string; type: 'success' | 'danger' };

const statusLabels: Record<WrongQuestionStatus, string> = {
  unresolved: '未掌握',
  resolved: '已掌握',
};
const NOTICE_DURATION = 1800;

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function getSummary(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function getClientTimestamp() {
  return Number(new Date());
}

export default function ErrorBookPage() {
  const currentUser = useUserStore((s) => s.currentUser);
  const searchParams = useSearchParams();
  const focusId = getWrongQuestionFocusId(searchParams);
  const [items, setItems] = useState<WrongQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState('全部');
  const [selected, setSelected] = useState<WrongQuestionRecord | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const userId = currentUser?.id ?? null;
  const wrongQuestionsQuery = useWrongQuestions({ pageSize: 50 });
  const updateWrongQuestion = useUpdateWrongQuestion();
  const deleteWrongQuestion = useDeleteWrongQuestion();

  const showNotice = (message: string, type: ActionNotice['type'] = 'success') => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice({ message, type });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, NOTICE_DURATION);
  };

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const timeout = new Promise<WrongQuestionRecord[]>((_, reject) => {
      window.setTimeout(() => reject(new Error('本地数据库升级超时')), 3000);
    });

    const records = db.wrongQuestions
      .where('userId')
      .equals(userId)
      .sortBy('createdAt')
      .then((items) => items.reverse());

    void Promise.race([records, timeout])
      .then((records) => {
        if (cancelled) return;
        setItems(records);
        setLoadError('');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[WrongQuestions]', error);
        setLoadError('本地数据库正在升级。请关闭其他 PrepMind 标签页后刷新。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const serverItems = wrongQuestionsQuery.data?.items;
    if (!serverItems || !userId) return;

    let cancelled = false;
    const syncServerItems = async () => {
      const cachedItems = await db.wrongQuestions
        .where('userId')
        .equals(userId)
        .toArray()
        .catch(() => []);
      const mergedItems = mergeWrongQuestionsFromServer(serverItems, cachedItems);

      if (cancelled) return;
      setItems(mergedItems);
      setLoadError('');
      setLoading(false);
      setSelected((prev) =>
        prev ? (mergedItems.find((item) => item.id === prev.id) ?? null) : prev,
      );
      void db
        .transaction('rw', db.wrongQuestions, async () => {
          await db.wrongQuestions.where('userId').equals(userId).delete();
          if (mergedItems.length > 0) {
            await db.wrongQuestions.bulkPut(mergedItems);
          }
        })
        .catch((error) => {
          console.error('[WrongQuestions cache sync]', error);
        });
    };

    queueMicrotask(() => {
      void syncServerItems();
    });

    return () => {
      cancelled = true;
    };
  }, [userId, wrongQuestionsQuery.data?.items]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!focusId) return;

    const applyTimer = window.setTimeout(() => {
      setHighlightedId(focusId);
      setStatusFilter('all');
      setSubjectFilter('全部');
    }, 0);
    const clearTimer = window.setTimeout(() => setHighlightedId(null), 2200);

    return () => {
      window.clearTimeout(applyTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusId]);

  useEffect(() => {
    if (!highlightedId || items.length === 0) return;

    const target = document.getElementById(`wrong-question-${highlightedId}`);
    if (!target) return;

    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [highlightedId, items.length]);

  const subjects = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => item.subject || '其他')));
    return ['全部', ...values];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.pendingOperation === 'delete') return false;
      const statusMatched = statusFilter === 'all' || item.status === statusFilter;
      const subjectMatched = subjectFilter === '全部' || item.subject === subjectFilter;
      return statusMatched && subjectMatched;
    });
  }, [items, statusFilter, subjectFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unresolved: items.filter((item) => item.status === 'unresolved').length,
      resolved: items.filter((item) => item.status === 'resolved').length,
    };
  }, [items]);

  const updateItem = async (id: string, patch: UpdateLocalWrongQuestionRequest) => {
    const current = items.find((item) => item.id === id);
    if (!current || !userId) return;

    const optimistic: WrongQuestionRecord = {
      ...current,
      ...patch,
      updatedAt: getClientTimestamp(),
      syncStatus: 'pending',
      syncError: undefined,
      pendingOperation: 'update',
    };

    await db.wrongQuestions.put(optimistic);
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
    setSelected((prev) => (prev?.id === id ? optimistic : prev));

    try {
      const updated = await updateWrongQuestion.mutateAsync({ id, patch });
      const synced: WrongQuestionRecord = {
        ...updated,
        syncStatus: 'synced',
        syncError: undefined,
        pendingOperation: undefined,
      };
      await db.wrongQuestions.put(synced);
      setItems((prev) => prev.map((item) => (item.id === id ? synced : item)));
      setSelected((prev) => (prev?.id === id ? synced : prev));
    } catch (error) {
      const errorMessage = getMutationErrorMessage(error);
      const failed: WrongQuestionRecord = {
        ...optimistic,
        syncStatus: 'failed',
        syncError: errorMessage,
        pendingOperation: 'update',
      };

      await db.wrongQuestions.put(failed);
      await enqueueMutationQueueItem(
        createMutationQueueItem({
          userId,
          entity: 'wrongQuestion',
          operation: 'update',
          entityId: id,
          payload: { patch },
        }),
      );
      setItems((prev) => prev.map((item) => (item.id === id ? failed : item)));
      setSelected((prev) => (prev?.id === id ? failed : prev));
      showNotice('网络异常，修改已暂存，稍后自动同步');
    }
  };

  const deleteItem = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current || !userId) return;

    setDeletingId(id);
    const deletingRecord: WrongQuestionRecord = {
      ...current,
      syncStatus: 'pending',
      syncError: undefined,
      pendingOperation: 'delete',
      updatedAt: getClientTimestamp(),
    };

    await db.wrongQuestions.put(deletingRecord);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelected(null);
    setPendingDeleteId(null);

    try {
      await deleteWrongQuestion.mutateAsync(id);
      await db.wrongQuestions.delete(id);
      showNotice(getCrudSuccessMessage('错题', 'delete'), 'danger');
    } catch (error) {
      const errorMessage = getMutationErrorMessage(error);
      await db.wrongQuestions.put({
        ...deletingRecord,
        syncStatus: 'failed',
        syncError: errorMessage,
        pendingOperation: 'delete',
      });
      await enqueueMutationQueueItem(
        createMutationQueueItem({
          userId,
          entity: 'wrongQuestion',
          operation: 'delete',
          entityId: id,
          payload: { id },
        }),
      );
      showNotice('网络异常，删除已暂存，稍后自动同步', 'danger');
    } finally {
      setDeletingId(null);
    }
  };

  const loadingContent = loading && wrongQuestionsQuery.isLoading;
  const syncError = wrongQuestionsQuery.isError
    ? '服务端错题同步失败，当前展示本地缓存。'
    : '';

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
            aria-label="返回聊天"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">错题本</h1>
            <p className="text-xs text-muted-foreground">
              已接入服务端，离线时展示本地缓存
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="全部" value={stats.total} />
          <StatBox label="未掌握" value={stats.unresolved} />
          <StatBox label="已掌握" value={stats.resolved} />
        </div>
      </header>

      <main className="px-4 py-4">
        {notice && <ActionNoticeBar notice={notice} floating />}
        {syncError && !loadError && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            {syncError}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {[
            { value: 'all', label: '全部' },
            { value: 'unresolved', label: '未掌握' },
            { value: 'resolved', label: '已掌握' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatusFilter(item.value as StatusFilter)}
              className={`tap-target shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                statusFilter === item.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-1 flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
          {subjects.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => setSubjectFilter(subject)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium transition-colors ${
                subjectFilter === subject
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>

        {loadingContent ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : loadError ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
            <p className="text-sm font-medium">错题本暂时不可用</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="tap-target mt-4 flex items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              刷新页面
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState hasAny={items.length > 0} />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <WrongQuestionCard
                key={item.id}
                item={item}
                highlighted={highlightedId === item.id}
                onOpen={() => {
                  setPendingDeleteId(null);
                  setSelected(item);
                }}
                onToggleStatus={() =>
                  void (async () => {
                    const nextStatus = item.status === 'resolved' ? 'unresolved' : 'resolved';
                    try {
                      await updateItem(item.id, { status: nextStatus });
                      showNotice(nextStatus === 'resolved' ? '已标记为已掌握' : '已标记为未掌握');
                    } catch {
                      // updateItem keeps the optimistic value and queues a retry.
                    }
                  })()
                }
                deleteState={getDeleteActionState({
                  itemId: item.id,
                  pendingDeleteId,
                  deletingId,
                })}
                onRequestDelete={() => setPendingDeleteId(item.id)}
                onCancelDelete={() => setPendingDeleteId(null)}
                onConfirmDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <WrongQuestionDetail
          key={selected.id}
          item={selected}
          onClose={() => {
            setPendingDeleteId(null);
            setSelected(null);
          }}
          deleteState={getDeleteActionState({
            itemId: selected.id,
            pendingDeleteId,
            deletingId,
          })}
          onRequestDelete={() => setPendingDeleteId(selected.id)}
          onCancelDelete={() => setPendingDeleteId(null)}
          onConfirmDelete={() => deleteItem(selected.id)}
          onUpdate={(patch) => updateItem(selected.id, patch)}
          onAction={showNotice}
        />
      )}
    </div>
  );
}

function ActionNoticeBar({
  notice,
  floating = false,
}: {
  notice: ActionNotice;
  floating?: boolean;
}) {
  return (
    <div
      className={`${floating ? 'fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] mx-auto max-w-md shadow-lg backdrop-blur' : 'mb-3'} flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
        notice.type === 'danger'
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : 'border-primary/20 bg-primary/10 text-primary'
      }`}
      role="status"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>{notice.message}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
      <BookOpen className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{hasAny ? '当前筛选下没有错题' : '还没有保存错题'}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        拍照识题后，在 AI 识别结果下方点击保存到错题本。
      </p>
      {!hasAny && (
        <Link
          href="/chat"
          className="tap-target mt-4 flex items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          去拍照识题
        </Link>
      )}
    </div>
  );
}

function WrongQuestionCard({
  item,
  highlighted,
  onOpen,
  onToggleStatus,
  deleteState,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  item: WrongQuestionRecord;
  highlighted?: boolean;
  onOpen: () => void;
  onToggleStatus: () => void;
  deleteState: DeleteActionState;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const confirmingDelete = deleteState !== 'idle';

  return (
    <article
      id={`wrong-question-${item.id}`}
      className={`rounded-lg border bg-card p-3 transition-all duration-300 active:bg-muted/40 ${
        highlighted
          ? 'border-primary/50 bg-primary/5 shadow-sm ring-2 ring-primary/20'
          : 'border-border'
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{item.subject || '其他'}</Badge>
              <Badge subtle>{item.errorType || '其他'}</Badge>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  item.status === 'resolved'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {statusLabels[item.status]}
              </span>
              {item.syncStatus === 'failed' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  待同步
                </span>
              )}
            </div>
            <p className="mt-2 max-h-12 overflow-hidden text-sm font-medium leading-6">
              {getSummary(item.questionText)}
            </p>
          </div>
          {item.imageUrl && (
            <Image
              src={item.imageUrl}
              alt="错题图片"
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-border"
            />
          )}
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleStatus}
            className="tap-target flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.98]"
          >
            <CheckCircle2 className="h-4 w-4" />
            {item.status === 'resolved' ? '标为未掌握' : '标为已掌握'}
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={confirmingDelete}
            className="tap-target flex h-9 w-9 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.96]"
            aria-label="删除错题"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {confirmingDelete && (
        <DeleteConfirmStrip
          state={deleteState}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      )}
    </article>
  );
}

function DeleteConfirmStrip({
  state,
  onCancel,
  onConfirm,
}: {
  state: DeleteActionState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const deleting = state === 'deleting';

  return (
    <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
      <p className="text-xs font-medium text-destructive">删除后无法恢复，确认删除这道错题？</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="min-h-10 rounded-md border border-border bg-background text-xs font-medium text-foreground transition-colors active:scale-[0.98] disabled:text-muted-foreground"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting}
          className={getDeleteConfirmButtonClassName()}
        >
          {deleting ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              删除中
            </span>
          ) : (
            '确认删除'
          )}
        </button>
      </div>
    </div>
  );
}

function WrongQuestionDetail({
  item,
  onClose,
  deleteState,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onUpdate,
  onAction,
}: {
  item: WrongQuestionRecord;
  onClose: () => void;
  deleteState: DeleteActionState;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onUpdate: (patch: UpdateLocalWrongQuestionRequest) => Promise<void>;
  onAction: (message: string, type?: ActionNotice['type']) => void;
}) {
  const [note, setNote] = useState(item.userNote);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [detailNotice, setDetailNotice] = useState<ActionNotice | null>(null);
  const detailNoticeTimerRef = useRef<number | null>(null);
  const noteSavedTimerRef = useRef<number | null>(null);
  const noteChanged = note !== item.userNote;
  const confirmingDelete = deleteState !== 'idle';

  const showDetailNotice = (message: string, type: ActionNotice['type'] = 'success') => {
    if (detailNoticeTimerRef.current) {
      window.clearTimeout(detailNoticeTimerRef.current);
    }
    setDetailNotice({ message, type });
    detailNoticeTimerRef.current = window.setTimeout(() => {
      setDetailNotice(null);
      detailNoticeTimerRef.current = null;
    }, NOTICE_DURATION);
  };

  useEffect(() => {
    return () => {
      if (detailNoticeTimerRef.current) {
        window.clearTimeout(detailNoticeTimerRef.current);
      }
      if (noteSavedTimerRef.current) {
        window.clearTimeout(noteSavedTimerRef.current);
      }
    };
  }, []);

  const saveNote = async () => {
    if (!noteChanged || savingNote) return;
    setSavingNote(true);
    setNoteSaved(false);
    try {
      await onUpdate({ userNote: note });
      setNoteSaved(true);
      const message = getCrudSuccessMessage('备注', 'save');
      showDetailNotice(message);
      if (shouldForwardCrudNotice('detail')) onAction(message);
      if (noteSavedTimerRef.current) {
        window.clearTimeout(noteSavedTimerRef.current);
      }
      noteSavedTimerRef.current = window.setTimeout(() => {
        setNoteSaved(false);
        noteSavedTimerRef.current = null;
      }, 1400);
    } finally {
      setSavingNote(false);
    }
  };

  const toggleStatus = async () => {
    if (statusUpdating) return;

    const nextStatus = item.status === 'resolved' ? 'unresolved' : 'resolved';
    setStatusUpdating(true);
    try {
      await onUpdate({ status: nextStatus });
      const message = nextStatus === 'resolved' ? '已标记为已掌握' : '已标记为未掌握';
      showDetailNotice(message);
      if (shouldForwardCrudNotice('detail')) onAction(message);
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">错题详情</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  item.status === 'resolved'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {statusLabels[item.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {detailNotice && (
          <div className="mt-3">
            <ActionNoticeBar notice={detailNotice} />
          </div>
        )}
      </header>

      <div className="h-[calc(100dvh-4.25rem)] overflow-y-auto bg-muted/30 px-4 py-4 pb-48">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge>{item.subject || '其他'}</Badge>
            <Badge subtle>{item.category || '未分类'}</Badge>
            <Badge subtle>{item.errorType || '其他'}</Badge>
          </div>
        </div>

        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt="错题图片"
            width={800}
            height={480}
            unoptimized
            className="mt-4 max-h-80 w-full rounded-lg object-contain ring-1 ring-border"
          />
        )}

        <DetailSection title="题目" content={item.questionText} />
        {item.knowledgePoints.length > 0 && (
          <section className="mt-4 rounded-lg border border-border bg-background p-3">
            <h3 className="text-sm font-semibold">知识点</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.knowledgePoints.map((point) => (
                <Badge key={point} subtle>
                  {point}
                </Badge>
              ))}
            </div>
          </section>
        )}
        <DetailSection title="分析思路" content={item.analysis} />
        <DetailSection title="参考答案" content={item.answer} />

        <section className="mt-4 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">我的备注</h3>
            <button
              type="button"
              onClick={() => void saveNote()}
              disabled={savingNote || !noteChanged}
              className="min-h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:active:scale-100"
            >
              {savingNote
                ? '保存中...'
                : noteSaved
                  ? '已保存'
                  : noteChanged
                    ? '保存备注'
                    : '已同步'}
            </button>
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="记录这道题为什么错、下次注意什么"
            className="mt-2 min-h-24 text-sm"
          />
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="space-y-2">
            {confirmingDelete && (
              <DeleteConfirmStrip
                state={deleteState}
                onCancel={onCancelDelete}
                onConfirm={onConfirmDelete}
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void toggleStatus()}
                disabled={statusUpdating}
                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:active:scale-100"
              >
                {statusUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                {statusUpdating
                  ? '更新中...'
                  : item.status === 'resolved'
                    ? '标为未掌握'
                    : '标为已掌握'}
              </button>
              <button
                type="button"
                onClick={onRequestDelete}
                disabled={confirmingDelete}
                className="tap-target flex h-11 items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors active:scale-[0.96]"
                aria-label="删除错题"
              >
                <Trash2 className="h-5 w-5" />
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, content }: { title: string; content: string }) {
  if (!content.trim()) return null;

  return (
    <section className="mt-4 rounded-lg border border-border bg-background p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-6">
        <MarkdownRenderer content={formatOcrContentForDisplay(content)} />
      </div>
    </section>
  );
}

function Badge({ children, subtle = false }: { children: ReactNode; subtle?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        subtle ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
      }`}
    >
      {children}
    </span>
  );
}
