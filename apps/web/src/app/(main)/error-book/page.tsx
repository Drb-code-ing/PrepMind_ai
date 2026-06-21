'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FolderOpen,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  WrongQuestionDeckResponse,
  WrongQuestionSubjectGroupResponse,
} from '@repo/types/api/wrong-question-organizer';

import MarkdownRenderer from '@/components/markdown/markdown-renderer';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateReviewCardFromWrongQuestion,
  useWrongQuestionReviewCard,
} from '@/hooks/use-reviews';
import {
  useOrganizeWrongQuestionBatch,
  useUpdateWrongQuestionDeck,
  useWrongQuestionDeckQuestions,
  useWrongQuestionDecks,
  useWrongQuestionGroups,
} from '@/hooks/use-wrong-question-organizer';
import {
  useDeleteWrongQuestion,
  useUpdateWrongQuestion,
  useWrongQuestions,
} from '@/hooks/use-wrong-questions';
import {
  getCrudSuccessMessage,
  getDeleteActionState,
  getDeleteConfirmButtonClassName,
  shouldForwardCrudNotice,
  type DeleteActionState,
} from '@/lib/crud-feedback';
import { db } from '@/lib/db';
import type { WrongQuestionRecord, WrongQuestionStatus } from '@/lib/db';
import { getDisplayKnowledgePoints } from '@/lib/knowledge-points';
import {
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getMutationErrorMessage,
} from '@/lib/mutation-queue';
import { mergeWrongQuestionsFromServer } from '@/lib/server-cache-sync';
import { formatWrongQuestionFieldForDisplay } from '@/lib/wrong-question-parser';
import {
  mapWrongQuestionResponseToLocalRecord,
  type UpdateLocalWrongQuestionRequest,
} from '@/lib/wrong-question-api';
import {
  formatOrganizerCountLabel,
  getDeckHref,
  getOrganizerConfidenceLabel,
  getOrganizerMasteryPercent,
  getSubjectGroupHref,
} from '@/lib/wrong-question-organizer-view';
import { getWrongQuestionFocusId } from '@/lib/wrong-question-navigation';
import { useUserStore } from '@/stores/userStore';

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

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getSummary(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function getClientTimestamp() {
  return Number(new Date());
}

export default function ErrorBookPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const searchParams = useSearchParams();
  const subjectGroupId = searchParams.get('subjectGroupId');
  const deckId = searchParams.get('deckId');
  const viewMode = deckId ? 'deck' : subjectGroupId ? 'subject' : 'home';
  const focusId = getWrongQuestionFocusId(searchParams);
  const [items, setItems] = useState<WrongQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState('全部');
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editingDeckName, setEditingDeckName] = useState('');
  const [selected, setSelected] = useState<WrongQuestionRecord | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const userId = currentUser?.id ?? null;
  const wrongQuestionsQuery = useWrongQuestions({ pageSize: 50 });
  const groupsQuery = useWrongQuestionGroups();
  const decksQuery = useWrongQuestionDecks(subjectGroupId);
  const deckQuestionsQuery = useWrongQuestionDeckQuestions(deckId, { page: 1, pageSize: 50 });
  const organizeBatch = useOrganizeWrongQuestionBatch();
  const updateDeck = useUpdateWrongQuestionDeck();
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
      .then((records) => records.reverse());

    void Promise.race([records, timeout])
      .then((records) => {
        if (cancelled) return;
        setItems(records);
        setLoadError('');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[WrongQuestions]', error);
        setLoadError('本地数据库正在升级。请关闭其它 PrepMind 标签页后刷新。');
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
      if (locallyDeletedIds.has(item.id)) return false;
      const statusMatched = statusFilter === 'all' || item.status === statusFilter;
      const subjectMatched =
        viewMode === 'deck' ||
        subjectFilter === '全部' ||
        (item.subject || '其他') === subjectFilter;
      return statusMatched && subjectMatched;
    });
  }, [items, locallyDeletedIds, statusFilter, subjectFilter, viewMode]);

  const groups = groupsQuery.data?.items ?? [];
  const hasOrganizerGroups = groups.length > 0;
  const currentSubjectGroup = decksQuery.data?.subjectGroup ?? null;
  const decks = decksQuery.data?.items ?? [];
  const currentDeck = deckQuestionsQuery.data?.deck ?? null;
  const cachedItemsById = useMemo(() => {
    return new Map(items.map((item) => [item.id, item]));
  }, [items]);
  const deckQuestionItems = useMemo(() => {
    return (deckQuestionsQuery.data?.items ?? [])
      .map((item) => {
        const localRecord = mapWrongQuestionResponseToLocalRecord(item);
        return cachedItemsById.get(localRecord.id) ?? localRecord;
      })
      .filter((item) => item.pendingOperation !== 'delete' && !locallyDeletedIds.has(item.id))
      .filter((item) => statusFilter === 'all' || item.status === statusFilter);
  }, [cachedItemsById, deckQuestionsQuery.data?.items, locallyDeletedIds, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unresolved: items.filter((item) => item.status === 'unresolved').length,
      resolved: items.filter((item) => item.status === 'resolved').length,
    };
  }, [items]);

  const organizerUnavailable =
    (viewMode === 'home' && groupsQuery.isError) ||
    (viewMode === 'subject' && decksQuery.isError) ||
    (viewMode === 'deck' && deckQuestionsQuery.isError);
  const organizerLoading =
    (viewMode === 'home' && groupsQuery.isLoading) ||
    (viewMode === 'subject' && decksQuery.isLoading) ||
    (viewMode === 'deck' && deckQuestionsQuery.isLoading);
  const flatListItems =
    viewMode === 'deck' && !organizerUnavailable ? deckQuestionItems : filteredItems;
  const deckBackHref = subjectGroupId
    ? getSubjectGroupHref({ id: subjectGroupId })
    : currentDeck?.subjectGroupId
      ? getSubjectGroupHref({ id: currentDeck.subjectGroupId })
      : '/error-book';
  const headerBackHref = viewMode === 'home' ? '/chat' : viewMode === 'deck' ? deckBackHref : '/error-book';
  const headerBackLabel = viewMode === 'home' ? '返回聊天' : '返回错题本';
  const headerTitle =
    viewMode === 'deck'
      ? (currentDeck?.name ?? '专题错题')
      : viewMode === 'subject'
        ? (currentSubjectGroup?.displayName ?? '学科错题')
        : '错题本';
  const headerDescription =
    viewMode === 'home'
      ? '按学科和专题整理历史错题'
      : viewMode === 'subject'
        ? '选择专题继续下钻复习'
        : '当前专题内的错题列表';

  const updateItem = async (id: string, patch: UpdateLocalWrongQuestionRequest) => {
    const current =
      items.find((item) => item.id === id) ??
      deckQuestionItems.find((item) => item.id === id) ??
      (selected?.id === id ? selected : null);
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
    setItems((prev) => {
      const hasItem = prev.some((item) => item.id === id);
      return hasItem ? prev.map((item) => (item.id === id ? optimistic : item)) : [optimistic, ...prev];
    });
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
      setItems((prev) => {
        const hasItem = prev.some((item) => item.id === id);
        return hasItem ? prev.map((item) => (item.id === id ? synced : item)) : [synced, ...prev];
      });
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
      setItems((prev) => {
        const hasItem = prev.some((item) => item.id === id);
        return hasItem ? prev.map((item) => (item.id === id ? failed : item)) : [failed, ...prev];
      });
      setSelected((prev) => (prev?.id === id ? failed : prev));
      showNotice('网络异常，修改已暂存，稍后自动同步');
    }
  };

  const deleteItem = async (id: string) => {
    const current =
      items.find((item) => item.id === id) ??
      deckQuestionItems.find((item) => item.id === id) ??
      (selected?.id === id ? selected : null);
    if (!current || !userId) return;

    setDeletingId(id);
    setLocallyDeletedIds((prev) => new Set(prev).add(id));
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

  const organizeHistory = async () => {
    try {
      const result = await organizeBatch.mutateAsync({ limit: 50 });
      showNotice(
        result.organizedCount > 0
          ? `已整理 ${result.organizedCount} 道历史错题`
          : '暂无需要整理的历史错题',
      );
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'danger');
    }
  };

  const startRenameDeck = (deck: WrongQuestionDeckResponse) => {
    setEditingDeckId(deck.id);
    setEditingDeckName(deck.name);
  };

  const cancelRenameDeck = () => {
    setEditingDeckId(null);
    setEditingDeckName('');
  };

  const saveDeckName = async (deck: WrongQuestionDeckResponse) => {
    const nextName = editingDeckName.trim();
    if (!nextName || nextName === deck.name || updateDeck.isPending) {
      if (nextName === deck.name) cancelRenameDeck();
      return;
    }

    try {
      await updateDeck.mutateAsync({
        deckId: deck.id,
        request: { name: nextName, nameLocked: true },
      });
      cancelRenameDeck();
      showNotice('专题名称已保存');
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'danger');
    }
  };

  const loadingContent = (loading && wrongQuestionsQuery.isLoading) || organizerLoading;
  const syncError = wrongQuestionsQuery.isError
    ? '服务端错题同步失败，当前展示本地缓存。'
    : '';
  const showFlatFilters =
    organizerUnavailable ||
    viewMode === 'deck' ||
    (viewMode === 'home' && (!hasOrganizerGroups || groupsQuery.isError));
  const showSubjectFilter = showFlatFilters && viewMode !== 'deck';
  const showOrganizeButton =
    organizeBatch.isPending ||
    viewMode === 'subject' ||
    (viewMode === 'home' && !hasOrganizerGroups && items.length > 0);

  const openItem = (item: WrongQuestionRecord) => {
    setPendingDeleteId(null);
    setSelected(item);
  };

  const toggleItemStatus = async (item: WrongQuestionRecord) => {
    const nextStatus = item.status === 'resolved' ? 'unresolved' : 'resolved';
    try {
      await updateItem(item.id, { status: nextStatus });
      showNotice(nextStatus === 'resolved' ? '已标记为已掌握' : '已标记为未掌握');
    } catch {
      // updateItem keeps the optimistic value and queues a retry.
    }
  };

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <Link
              href={headerBackHref}
              className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
              aria-label={headerBackLabel}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--pm-muted)]">Mistake notebook</p>
              <h1 className="truncate text-lg font-semibold leading-tight">{headerTitle}</h1>
              <p className="mt-0.5 text-xs text-[var(--pm-muted)]">{headerDescription}</p>
            </div>
            <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff7d6] text-sm font-black text-[#247269] ring-1 ring-[#f3e6a8]">
              复
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatBox label="全部" value={stats.total} />
            <StatBox label="未掌握" value={stats.unresolved} />
            <StatBox label="已掌握" value={stats.resolved} />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        {notice ? <ActionNoticeBar notice={notice} floating /> : null}
        {syncError && !loadError ? (
          <div className="pm-enter mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            {syncError}
          </div>
        ) : null}
        {organizerUnavailable ? <OrganizerWarning /> : null}
        {showOrganizeButton ? (
          <OrganizeHistoryButton
            pending={organizeBatch.isPending}
            onClick={() => void organizeHistory()}
          />
        ) : null}

        {showFlatFilters ? (
          <>
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
                  className={`tap-target shrink-0 rounded-full px-4 text-sm font-semibold ring-1 transition-all active:scale-95 ${
                    statusFilter === item.value
                      ? 'bg-[#2b2335] text-white ring-[#2b2335]'
                      : 'bg-white/75 text-[var(--pm-muted)] ring-[var(--pm-line)] hover:bg-white hover:text-[var(--pm-ink)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {showSubjectFilter ? (
              <div className="mt-1 flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSubjectFilter(subject)}
                    className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold ring-1 transition-all active:scale-95 ${
                      subjectFilter === subject
                        ? 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]'
                        : 'bg-white/65 text-[var(--pm-muted)] ring-[var(--pm-line)] hover:bg-white'
                    }`}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {loadingContent ? (
          <div className="pm-glass-card flex min-h-48 items-center justify-center rounded-[1.35rem] text-sm text-[var(--pm-muted)]">
            加载中...
          </div>
        ) : loadError ? (
          <div className="pm-glass-card flex min-h-64 flex-col items-center justify-center rounded-[1.35rem] px-6 text-center">
            <p className="text-sm font-semibold">错题本暂时不可用</p>
            <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="tap-target mt-4 flex items-center justify-center rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all active:scale-95"
            >
              刷新页面
            </button>
          </div>
        ) : organizerUnavailable ? (
          <WrongQuestionList
            items={filteredItems}
            hasAny={items.length > 0}
            highlightedId={highlightedId}
            pendingDeleteId={pendingDeleteId}
            deletingId={deletingId}
            onOpen={openItem}
            onToggleStatus={(item) => void toggleItemStatus(item)}
            onRequestDelete={(id) => setPendingDeleteId(id)}
            onCancelDelete={() => setPendingDeleteId(null)}
            onConfirmDelete={(id) => void deleteItem(id)}
          />
        ) : viewMode === 'home' && hasOrganizerGroups ? (
          <SubjectGroupList groups={groups} />
        ) : viewMode === 'subject' ? (
          <SubjectDeckView
            subjectGroup={currentSubjectGroup}
            decks={decks}
            editingDeckId={editingDeckId}
            editingDeckName={editingDeckName}
            renamePending={updateDeck.isPending}
            onEditName={setEditingDeckName}
            onStartRename={startRenameDeck}
            onCancelRename={cancelRenameDeck}
            onSaveRename={(deck) => void saveDeckName(deck)}
          />
        ) : viewMode === 'deck' ? (
          <WrongQuestionList
            items={flatListItems}
            hasAny={items.length > 0}
            highlightedId={highlightedId}
            pendingDeleteId={pendingDeleteId}
            deletingId={deletingId}
            onOpen={openItem}
            onToggleStatus={(item) => void toggleItemStatus(item)}
            onRequestDelete={(id) => setPendingDeleteId(id)}
            onCancelDelete={() => setPendingDeleteId(null)}
            onConfirmDelete={(id) => void deleteItem(id)}
          />
        ) : (
          <WrongQuestionList
            items={filteredItems}
            hasAny={items.length > 0}
            highlightedId={highlightedId}
            pendingDeleteId={pendingDeleteId}
            deletingId={deletingId}
            onOpen={openItem}
            onToggleStatus={(item) => void toggleItemStatus(item)}
            onRequestDelete={(id) => setPendingDeleteId(id)}
            onCancelDelete={() => setPendingDeleteId(null)}
            onConfirmDelete={(id) => void deleteItem(id)}
          />
        )}
      </main>

      {selected ? (
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
      ) : null}
    </div>
  );
}

function WrongQuestionList({
  items,
  hasAny,
  highlightedId,
  pendingDeleteId,
  deletingId,
  onOpen,
  onToggleStatus,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  items: WrongQuestionRecord[];
  hasAny: boolean;
  highlightedId: string | null;
  pendingDeleteId: string | null;
  deletingId: string | null;
  onOpen: (item: WrongQuestionRecord) => void;
  onToggleStatus: (item: WrongQuestionRecord) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyState hasAny={hasAny} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <WrongQuestionCard
          key={item.id}
          item={item}
          highlighted={highlightedId === item.id}
          onOpen={() => onOpen(item)}
          onToggleStatus={() => onToggleStatus(item)}
          deleteState={getDeleteActionState({
            itemId: item.id,
            pendingDeleteId,
            deletingId,
          })}
          onRequestDelete={() => onRequestDelete(item.id)}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={() => onConfirmDelete(item.id)}
        />
      ))}
    </div>
  );
}

function OrganizerWarning() {
  return (
    <div className="pm-enter mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-700">
      错题整理视图暂时不可用，当前展示基础错题列表。
    </div>
  );
}

function OrganizeHistoryButton({
  pending,
  onClick,
}: {
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="tap-target mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#fff6d8] px-4 text-sm font-semibold text-[#6f5212] ring-1 ring-[#ead68c] transition-all hover:bg-[#fff0bd] active:scale-[0.98] disabled:opacity-70"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? '整理中...' : '整理历史错题'}
    </button>
  );
}

function SubjectGroupList({ groups }: { groups: WrongQuestionSubjectGroupResponse[] }) {
  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const masteryPercent = getOrganizerMasteryPercent(group.totalCount, group.resolvedCount);

        return (
          <Link
            key={group.id}
            href={getSubjectGroupHref(group)}
            className="pm-glass-card pm-enter block rounded-[1.35rem] p-3 transition-all active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eafff9] text-[#247269] ring-1 ring-[#bdeee5]">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black">{group.displayName}</h2>
                    <p className="mt-0.5 text-xs font-medium text-[var(--pm-muted)]">
                      {formatOrganizerCountLabel(group.totalCount, group.unresolvedCount)}
                    </p>
                  </div>
                </div>
                <KnowledgePointRow points={group.topKnowledgePoints} />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-black text-[#247269]">{masteryPercent}%</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--pm-muted)]">
                  {group.deckCount} 个专题
                </p>
              </div>
            </div>
            <ProgressBar value={masteryPercent} />
          </Link>
        );
      })}
    </div>
  );
}

function SubjectDeckView({
  subjectGroup,
  decks,
  editingDeckId,
  editingDeckName,
  renamePending,
  onEditName,
  onStartRename,
  onCancelRename,
  onSaveRename,
}: {
  subjectGroup: WrongQuestionSubjectGroupResponse | null;
  decks: WrongQuestionDeckResponse[];
  editingDeckId: string | null;
  editingDeckName: string;
  renamePending: boolean;
  onEditName: (value: string) => void;
  onStartRename: (deck: WrongQuestionDeckResponse) => void;
  onCancelRename: () => void;
  onSaveRename: (deck: WrongQuestionDeckResponse) => void;
}) {
  if (!subjectGroup && decks.length === 0) {
    return <EmptyState hasAny />;
  }

  const masteryPercent = subjectGroup
    ? getOrganizerMasteryPercent(subjectGroup.totalCount, subjectGroup.resolvedCount)
    : 0;

  return (
    <div className="space-y-3">
      {subjectGroup ? (
        <section className="pm-glass-card pm-enter rounded-[1.35rem] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--pm-muted)]">学科整理</p>
              <h2 className="mt-1 text-lg font-black">{subjectGroup.displayName}</h2>
              <p className="mt-1 text-xs font-medium text-[var(--pm-muted)]">
                {formatOrganizerCountLabel(subjectGroup.totalCount, subjectGroup.unresolvedCount)}
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-[#eafff9] px-3 py-2 text-right text-[#247269] ring-1 ring-[#bdeee5]">
              <p className="text-lg font-black">{masteryPercent}%</p>
              <p className="text-[11px] font-semibold">已掌握</p>
            </div>
          </div>
          <KnowledgePointRow points={subjectGroup.topKnowledgePoints} />
          <ProgressBar value={masteryPercent} />
        </section>
      ) : null}

      {decks.length === 0 ? (
        <div className="pm-glass-card flex min-h-40 flex-col items-center justify-center rounded-[1.35rem] px-6 text-center">
          <FolderOpen className="h-8 w-8 text-[#247269]" />
          <p className="mt-3 text-sm font-semibold">还没有专题</p>
          <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
            点击上方整理历史错题后，会按知识点生成专题。
          </p>
        </div>
      ) : (
        decks.map((deck) => (
          <DeckCard
            key={deck.id}
            deck={deck}
            editing={editingDeckId === deck.id}
            editingName={editingDeckName}
            renamePending={renamePending}
            onEditName={onEditName}
            onStartRename={() => onStartRename(deck)}
            onCancelRename={onCancelRename}
            onSaveRename={() => onSaveRename(deck)}
          />
        ))
      )}
    </div>
  );
}

function DeckCard({
  deck,
  editing,
  editingName,
  renamePending,
  onEditName,
  onStartRename,
  onCancelRename,
  onSaveRename,
}: {
  deck: WrongQuestionDeckResponse;
  editing: boolean;
  editingName: string;
  renamePending: boolean;
  onEditName: (value: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSaveRename: () => void;
}) {
  return (
    <article className="pm-glass-card pm-enter rounded-[1.35rem] p-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={getDeckHref(deck)} className="min-w-0 flex-1">
          <div className="flex min-h-11 items-center gap-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff7d6] text-[#6f5212] ring-1 ring-[#f3e6a8]">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black">{deck.name}</h3>
              <p className="mt-0.5 text-xs font-medium text-[var(--pm-muted)]">
                {formatOrganizerCountLabel(deck.totalCount, deck.unresolvedCount)}
              </p>
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={onStartRename}
          className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/65 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white hover:text-[var(--pm-ink)] active:scale-95"
          aria-label="重命名专题"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {deck.description ? (
        <p className="mt-2 text-xs leading-5 text-[var(--pm-muted)]">{deck.description}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge subtle>{getOrganizerConfidenceLabel(deck.confidence)}</Badge>
        <Badge subtle>{deck.nameLocked ? '手动命名' : 'AI 命名'}</Badge>
      </div>
      <KnowledgePointRow points={deck.topKnowledgePoints} />

      {editing ? (
        <div className="mt-3 border-t border-[var(--pm-line)] pt-3">
          <label className="text-xs font-semibold text-[var(--pm-muted)]" htmlFor={`deck-${deck.id}`}>
            专题名称
          </label>
          <input
            id={`deck-${deck.id}`}
            value={editingName}
            onChange={(event) => onEditName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-2xl border border-[var(--pm-line)] bg-white/80 px-3 text-sm font-semibold outline-none transition focus:border-[#86dccf] focus:ring-2 focus:ring-[#86dccf]/25"
            maxLength={60}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancelRename}
              disabled={renamePending}
              className="min-h-11 rounded-2xl border border-[var(--pm-line)] bg-white/75 text-sm font-semibold text-[var(--pm-ink)] transition-all active:scale-[0.98] disabled:text-[var(--pm-muted)]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onSaveRename}
              disabled={renamePending || editingName.trim().length === 0}
              className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)]"
            >
              {renamePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function KnowledgePointRow({ points }: { points: string[] }) {
  if (points.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {points.slice(0, 4).map((point) => (
        <Badge key={point} subtle>
          {point}
        </Badge>
      ))}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const boundedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-[var(--pm-line)]">
      <div className="h-full rounded-full bg-[#86dccf]" style={{ width: `${boundedValue}%` }} />
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
      className={`${floating ? 'pm-enter fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] mx-auto max-w-md shadow-lg backdrop-blur' : 'mb-3'} flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold ${
        notice.type === 'danger'
          ? 'border-red-100 bg-red-50/95 text-red-700'
          : 'border-emerald-100 bg-emerald-50/95 text-emerald-700'
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
    <div className="rounded-2xl border border-[var(--pm-line)] bg-white/62 px-3 py-2">
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--pm-muted)]">{label}</p>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="pm-glass-card flex min-h-64 flex-col items-center justify-center rounded-[1.45rem] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#eafff9] text-[#247269] ring-1 ring-[#bdeee5]">
        <BookOpen className="h-7 w-7" />
      </div>
      <p className="mt-3 text-sm font-semibold">
        {hasAny ? '当前筛选下没有错题' : '还没有保存错题'}
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
        拍照识题后，在 AI 识别结果下方点击保存到错题本。
      </p>
      {!hasAny ? (
        <Link
          href="/chat"
          className="tap-target mt-4 flex items-center justify-center rounded-2xl bg-[#86dccf] px-4 text-sm font-semibold text-[#173b37] transition-all hover:bg-[#70cfc1] active:scale-95"
        >
          去拍照识题
        </Link>
      ) : null}
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
      className={`pm-glass-card pm-enter rounded-[1.35rem] p-3 transition-all duration-300 active:scale-[0.99] ${
        highlighted ? 'ring-2 ring-[#6fcbbf]/45' : ''
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{item.subject || '其他'}</Badge>
              <Badge subtle>{item.errorType || '其他'}</Badge>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  item.status === 'resolved'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                }`}
              >
                {statusLabels[item.status]}
              </span>
              {item.syncStatus === 'failed' ? (
                <span className="pm-sync-chip rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  待同步
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-h-12 overflow-hidden text-sm font-semibold leading-6 text-[var(--pm-ink)]">
              {getSummary(item.questionText)}
            </p>
          </div>
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt="错题图片"
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-[var(--pm-line)]"
            />
          ) : null}
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--pm-line)] pt-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--pm-muted)]">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleStatus}
            className="tap-target flex h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-[#347d70] transition-all hover:bg-[#effdf9] active:scale-[0.98]"
          >
            <CheckCircle2 className="h-4 w-4" />
            {item.status === 'resolved' ? '标为未掌握' : '标为已掌握'}
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={confirmingDelete}
            className="tap-target flex h-9 w-9 items-center justify-center rounded-xl text-red-600 transition-all hover:bg-red-50 active:scale-[0.96] disabled:opacity-50"
            aria-label="删除错题"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {confirmingDelete ? (
        <DeleteConfirmStrip
          state={deleteState}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      ) : null}
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
    <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/70 p-3">
      <p className="text-xs font-semibold text-red-700">删除后无法恢复，确认删除这道错题？</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="min-h-10 rounded-xl border border-[var(--pm-line)] bg-white/80 text-xs font-semibold text-[var(--pm-ink)] transition-all active:scale-[0.98] disabled:text-[var(--pm-muted)]"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting}
          className={`${getDeleteConfirmButtonClassName()} rounded-xl`}
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
  const reviewCardQuery = useWrongQuestionReviewCard(item.id);
  const createReviewCard = useCreateReviewCardFromWrongQuestion();
  const reviewCard = reviewCardQuery.data?.card ?? null;
  const displayKnowledgePoints = getDisplayKnowledgePoints(item.knowledgePoints);

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

  const addToReview = async () => {
    if (createReviewCard.isPending || reviewCard) return;

    try {
      const result = await createReviewCard.mutateAsync(item.id);
      const message = result.created ? '已加入复习计划' : '这道题已在复习计划中';
      showDetailNotice(message);
      if (shouldForwardCrudNotice('detail')) onAction(message);
    } catch (error) {
      const message = getMutationErrorMessage(error);
      showDetailNotice(message, 'danger');
      if (shouldForwardCrudNotice('detail')) onAction(message, 'danger');
    }
  };

  return (
    <div className="pm-anime-bg fixed inset-0 z-50 text-[var(--pm-ink)]">
      <header className="sticky top-0 z-10 border-b border-[var(--pm-line)] bg-white/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">错题详情</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    item.status === 'resolved'
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                  }`}
                >
                  {statusLabels[item.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--pm-muted)]">{formatDate(item.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {detailNotice ? (
            <div className="mt-3">
              <ActionNoticeBar notice={detailNotice} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="h-[calc(100dvh-4.25rem)] overflow-y-auto px-4 py-4 pb-48">
        <div className="mx-auto max-w-3xl">
          <div className="pm-glass-card rounded-[1.35rem] p-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{item.subject || '其他'}</Badge>
              <Badge subtle>{item.category || '未分类'}</Badge>
              <Badge subtle>{item.errorType || '其他'}</Badge>
            </div>
          </div>

          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt="错题图片"
              width={800}
              height={480}
              unoptimized
              className="mt-4 max-h-80 w-full rounded-[1.35rem] bg-white/60 object-contain ring-1 ring-[var(--pm-line)]"
            />
          ) : null}

          <DetailSection title="题目" content={item.questionText} />
          {displayKnowledgePoints.length > 0 ? (
            <section className="pm-glass-card mt-4 rounded-[1.35rem] p-3">
              <h3 className="text-sm font-semibold">知识点</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {displayKnowledgePoints.map((point) => (
                  <Badge key={point} subtle>
                    {point}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}
          <DetailSection title="分析思路" content={item.analysis} />
          <DetailSection title="参考答案" content={item.answer} />

          <section className="pm-glass-card mt-4 rounded-[1.35rem] p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">我的备注</h3>
              <button
                type="button"
                onClick={() => void saveNote()}
                disabled={savingNote || !noteChanged}
                className="min-h-9 rounded-xl bg-[#86dccf] px-3 text-xs font-semibold text-[#173b37] transition-all active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)]"
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
              className="mt-2 min-h-24 rounded-2xl border-[var(--pm-line)] bg-white/80 text-sm"
            />
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--pm-line)] bg-white/82 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="mx-auto max-w-3xl space-y-2">
            {confirmingDelete ? (
              <DeleteConfirmStrip
                state={deleteState}
                onCancel={onCancelDelete}
                onConfirm={onConfirmDelete}
              />
            ) : null}
            <button
              type="button"
              onClick={() => void addToReview()}
              disabled={createReviewCard.isPending || reviewCardQuery.isLoading || !!reviewCard}
              className={`tap-target flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold ring-1 transition-all active:scale-[0.98] disabled:active:scale-100 ${
                reviewCard
                  ? 'bg-[#eef7ff] text-[#315f86] ring-[#cfe5f8]'
                  : 'bg-[#fff6d8] text-[#6f5212] ring-[#ead68c] hover:bg-[#fff0bd]'
              }`}
            >
              {createReviewCard.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck className="h-4 w-4" />
              )}
              {createReviewCard.isPending
                ? '加入中...'
                : reviewCard
                  ? `复习中 · 下次 ${formatReviewDate(reviewCard.nextReview)}`
                  : '加入复习计划'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void toggleStatus()}
                disabled={statusUpdating}
                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)]"
              >
                {statusUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                className="tap-target flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-red-50 px-3 text-sm font-semibold text-red-600 ring-1 ring-red-100 transition-all active:scale-[0.96] disabled:opacity-50"
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
    <section className="pm-glass-card mt-4 rounded-[1.35rem] p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-6">
        <MarkdownRenderer content={formatWrongQuestionFieldForDisplay(content)} />
      </div>
    </section>
  );
}

function Badge({ children, subtle = false }: { children: ReactNode; subtle?: boolean }) {
  return (
    <span className={`${subtle ? 'pm-sync-chip' : 'pm-soft-chip'} rounded-full px-2 py-0.5 text-[11px] font-semibold`}>
      {children}
    </span>
  );
}
