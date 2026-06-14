'use client';

import { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { OcrQuestionResult, OcrStructuredResult } from '@repo/types/api/ocr-question';
import ChatTopBar from '@/components/chat/chat-top-bar';
import ChatSidebar from '@/components/chat/chat-sidebar';
import ChatInputBar from '@/components/chat/chat-input-bar';
import type { SelectedImage } from '@/components/chat/chat-input-bar';
import MarkdownRenderer from '@/components/markdown/markdown-renderer';
import StreamingMarkdownRenderer from '@/components/markdown/streaming-markdown-renderer';
import { useChatRuntime } from '@/components/providers/chat-runtime-provider';
import { useOcrRuntime } from '@/components/providers/ocr-runtime-provider';
import { useUserStore } from '@/stores/userStore';
import { db } from '@/lib/db';
import type { OcrRecord, WrongQuestionRecord } from '@/lib/db';
import { formatChatAssistantContent } from '@/lib/chat-content-formatter';
import { getScopedUserId } from '@/lib/user-scope';
import { ApiClientError } from '@/lib/api-client';
import {
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getMutationErrorMessage,
} from '@/lib/mutation-queue';
import { useCreateWrongQuestion } from '@/hooks/use-wrong-questions';
import { useStreamingAutoScroll } from '@/hooks/use-streaming-auto-scroll';
import {
  formatStreamingOcrContent,
  formatWrongQuestionFieldForDisplay,
  type OcrResultStatus,
} from '@/lib/wrong-question-parser';
import {
  canSaveStructuredQuestion,
  getDisplayMarkdownFromOcrContent,
  getPrimaryOcrQuestion,
  mapOcrQuestionToWrongQuestionRecord,
  normalizeOcrParsedPayload,
  toOcrStructuredResult,
} from '@/lib/ocr-structured-result';
import { getWrongQuestionFocusHref } from '@/lib/wrong-question-navigation';
import { ArrowRight, Bot, Check, CheckCircle2, Loader2, X } from 'lucide-react';

// ─── Unified message type for rendering ─────────────────────────────

type UnifiedMsg =
  | {
      kind: 'chat';
      id: string;
      role: 'user' | 'assistant';
      content: string;
      time: number;
      isLoading: boolean;
    }
  | {
      kind: 'ocr-user';
      id: string;
      type: 'user';
      groupId?: string;
      content: string;
      imageUrl?: string;
      time: number;
    }
  | {
      kind: 'ocr-result';
      id: string;
      type: 'ocr-result';
      groupId?: string;
      content: string;
      parsedJson?: OcrRecord['parsedJson'];
      imageUrl?: string;
      time: number;
      ocrStatus: OcrResultStatus;
    };

type PendingWrongQuestionSave = {
  result: OcrRecord;
  structuredResult: OcrStructuredResult;
  question: OcrQuestionResult;
  imageUrl?: string;
  sourceGroupId?: string;
  missingFields: string[];
};

const WRONG_QUESTION_FIELD_LABELS: Record<string, string> = {
  questionText: '题目',
  knowledgePoints: '知识点',
  analysis: '分析思路',
  answer: '参考答案',
};

function formatMissingWrongQuestionFields(fields: string[]) {
  return fields.map((field) => WRONG_QUESTION_FIELD_LABELS[field] ?? field).join('、');
}

function getStructuredResultFromOcrRecord(record: Pick<OcrRecord, 'content' | 'parsedJson'>) {
  return record.parsedJson
    ? normalizeOcrParsedPayload(record.parsedJson, record.content)
    : toOcrStructuredResult(record.content);
}

function getQuestionSaveSourceGroupId(sourceGroupId: string | undefined, questionId: string) {
  return sourceGroupId ? `${sourceGroupId}:${questionId}` : questionId;
}

// ─── Parent: gate by current user, runtime providers hydrate data ───

export default function ChatPage() {
  const currentUser = useUserStore((s) => s.currentUser);
  const userId = currentUser?.id ?? null;

  if (!userId) {
    return (
      <div className="pm-anime-bg flex h-[100dvh] flex-col items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--pm-muted)]" />
      </div>
    );
  }

  return <ChatView key={userId} userId={userId} />;
}

// ─── ChatView: main chat UI ─────────────────────────────────────────

function ChatView({ userId }: { userId: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentUser = useUserStore((s) => s.currentUser);
  const formRef = useRef<HTMLFormElement>(null);
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    chatError,
    setChatError,
    chatTimestamps,
    isHydrated: chatRuntimeHydrated,
  } = useChatRuntime();
  const {
    ocrMessages,
    ocrResultStatuses,
    ocrLoading,
    startOcr,
    stopOcr,
    isHydrated: ocrRuntimeHydrated,
  } = useOcrRuntime();

  // ── UI state ──
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [savedWrongGroupIds, setSavedWrongGroupIds] = useState<Set<string>>(new Set());
  const [savedWrongQuestionIdsByGroup, setSavedWrongQuestionIdsByGroup] = useState<
    Record<string, string>
  >({});
  const [saveWrongErrors, setSaveWrongErrors] = useState<Record<string, string>>({});
  const [pendingWrongQuestion, setPendingWrongQuestion] =
    useState<PendingWrongQuestionSave | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const createWrongQuestion = useCreateWrongQuestion();

  const handleImageSelect = useCallback((img: SelectedImage) => {
    setSelectedImage(img);
  }, []);

  const handleImageRemove = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const isGenerating = isLoading || ocrLoading;

  useEffect(() => {
    db.wrongQuestions
      .where('userId')
      .equals(userId)
      .toArray()
      .then((items) => {
        setSavedWrongGroupIds(
          new Set(items.map((item) => item.sourceGroupId).filter(Boolean) as string[]),
        );
        setSavedWrongQuestionIdsByGroup(
          Object.fromEntries(
            items
              .filter((item): item is WrongQuestionRecord & { sourceGroupId: string } =>
                Boolean(item.sourceGroupId),
              )
              .map((item) => [item.sourceGroupId, item.id]),
          ),
        );
      });
  }, [userId]);

  // ── Scroll ──
  const latestChatMessage = messages[messages.length - 1];
  const latestOcrMessage = ocrMessages[ocrMessages.length - 1];
  const scrollContentKey = [
    messages.length,
    latestChatMessage?.id ?? '',
    latestChatMessage?.content.length ?? 0,
    ocrMessages.length,
    latestOcrMessage?.id ?? '',
    latestOcrMessage?.content.length ?? 0,
    isLoading ? 'chat-loading' : 'chat-idle',
    ocrLoading ? 'ocr-loading' : 'ocr-idle',
  ].join(':');
  const { scrollRef, handleScroll, handleUserScrollIntent, scrollToBottom } =
    useStreamingAutoScroll<HTMLDivElement>({
      contentKey: scrollContentKey,
      enabled: true,
      isGenerating,
    });

  // ── OCR submit ──
  const handleOcrSubmit = useCallback(async () => {
    if (!selectedImage || isGenerating) return;

    const image = selectedImage;
    const userText = input.trim();
    setChatError(null);
    setSelectedImage(null);
    setInput('');
    scrollToBottom({ force: true });

    await startOcr({ image, userText });
  }, [
    input,
    isGenerating,
    scrollToBottom,
    selectedImage,
    setChatError,
    setInput,
    startOcr,
  ]);

  const handleStopGeneration = useCallback(() => {
    if (ocrLoading) stopOcr();
    if (isLoading) stop();
  }, [isLoading, ocrLoading, stop, stopOcr]);

  const handleQuickSend = useCallback(
    (text: string) => {
      if (isGenerating) return;
      setInput(text);
      scrollToBottom({ force: true });
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    },
    [isGenerating, setInput, scrollToBottom],
  );

  const prepareWrongQuestionSave = useCallback(
    async (result: OcrRecord, preferredQuestionId?: string) => {
      const ownerId = getScopedUserId({ id: userId });
      if (!result.content.trim()) return;

      const sourceGroupId = result.groupId;
      const structuredResult = getStructuredResultFromOcrRecord(result);
      const question =
        structuredResult.questions.find((item) => item.id === preferredQuestionId) ??
        getPrimaryOcrQuestion(structuredResult);
      const ocrStatus = sourceGroupId ? (ocrResultStatuses[sourceGroupId] ?? 'done') : 'done';
      const saveSourceGroupId = question
        ? getQuestionSaveSourceGroupId(sourceGroupId, question.id)
        : sourceGroupId;

      if (!question || ocrStatus !== 'done' || !canSaveStructuredQuestion(question)) {
        if (saveSourceGroupId) {
          setSaveWrongErrors((prev) => ({
            ...prev,
            [saveSourceGroupId]: !question
              ? '未识别到可保存的题目'
              : ocrStatus !== 'done'
                ? '识别完成后才能保存到错题本'
                : '这条识别结果暂不适合保存到错题本',
          }));
        }
        return;
      }

      const duplicateKeys = Array.from(
        new Set([saveSourceGroupId, sourceGroupId].filter(Boolean) as string[]),
      );
      for (const key of duplicateKeys) {
        const existing = await db.wrongQuestions
          .where('[userId+sourceGroupId]')
          .equals([ownerId, key])
          .first();
        if (existing) {
          setSavedWrongGroupIds((prev) => new Set(prev).add(key));
          setSavedWrongQuestionIdsByGroup((prev) => ({
            ...prev,
            [key]: existing.id,
          }));
          setSaveWrongErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          return;
        }
      }

      const relatedUser = sourceGroupId
        ? ocrMessages.find((msg) => msg.type === 'user' && msg.groupId === sourceGroupId)
        : [...ocrMessages]
            .reverse()
            .find((msg) => msg.type === 'user' && msg.createdAt <= result.createdAt);

      setPendingWrongQuestion({
        result,
        structuredResult,
        question,
        imageUrl: result.imageUrl ?? relatedUser?.imageUrl,
        sourceGroupId,
        missingFields: question.warnings,
      });
    },
    [ocrMessages, ocrResultStatuses, userId],
  );

  const confirmWrongQuestionSave = useCallback(async () => {
    if (!pendingWrongQuestion || confirmSaving) return;

    const ownerId = getScopedUserId({ id: userId });
    const { result, structuredResult, question, imageUrl, sourceGroupId } = pendingWrongQuestion;
    const now = Date.now();
    const record = mapOcrQuestionToWrongQuestionRecord(question, {
      id: crypto.randomUUID(),
      userId: ownerId,
      sourceRecordId: result.id,
      sourceGroupId,
      imageUrl,
      now,
      rawContent: structuredResult.rawText || question.displayMarkdown || result.content,
    });
    const savedSourceGroupId = record.sourceGroupId;

    setConfirmSaving(true);
    try {
      const savedRecord = await createWrongQuestion.mutateAsync(record);
      await db.wrongQuestions.put({
        ...savedRecord,
        imageUrl: savedRecord.imageUrl ?? record.imageUrl,
        syncStatus: 'synced',
        syncError: undefined,
        pendingOperation: undefined,
      });
      if (savedSourceGroupId) {
        setSavedWrongGroupIds((prev) => new Set(prev).add(savedSourceGroupId));
        setSavedWrongQuestionIdsByGroup((prev) => ({
          ...prev,
          [savedSourceGroupId]: savedRecord.id,
        }));
        setSaveWrongErrors((prev) => {
          const next = { ...prev };
          delete next[savedSourceGroupId];
          return next;
        });
      }
      setPendingWrongQuestion(null);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'WRONG_QUESTION_DUPLICATED') {
        if (savedSourceGroupId) {
          setSavedWrongGroupIds((prev) => new Set(prev).add(savedSourceGroupId));
          setSaveWrongErrors((prev) => {
            const next = { ...prev };
            delete next[savedSourceGroupId];
            return next;
          });
        }
        setPendingWrongQuestion(null);
        return;
      }

      const errorMessage = getMutationErrorMessage(error);
      const localRecord: WrongQuestionRecord = {
        ...record,
        syncStatus: 'failed',
        syncError: errorMessage,
        pendingOperation: 'create',
      };

      await db.wrongQuestions.put(localRecord);
      await enqueueMutationQueueItem(
        createMutationQueueItem({
          userId: ownerId,
          entity: 'wrongQuestion',
          operation: 'create',
          entityId: record.id,
          payload: { record },
        }),
      );

      if (savedSourceGroupId) {
        setSavedWrongGroupIds((prev) => new Set(prev).add(savedSourceGroupId));
        setSavedWrongQuestionIdsByGroup((prev) => ({
          ...prev,
          [savedSourceGroupId]: record.id,
        }));
        setSaveWrongErrors((prev) => ({
          ...prev,
          [savedSourceGroupId]: '网络异常，错题已暂存，稍后自动同步',
        }));
      }
      setPendingWrongQuestion(null);
      return;
    } finally {
      setConfirmSaving(false);
    }
  }, [confirmSaving, createWrongQuestion, pendingWrongQuestion, userId]);

  // ── Unified message timeline (chat + OCR interleaved by time) ──
  const unifiedMessages = useMemo<UnifiedMsg[]>(() => {
    const ts = chatTimestamps;
    const chatEntries: UnifiedMsg[] = messages.map((msg, i) => ({
      kind: 'chat',
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      time: ts[msg.id] ?? i,
      isLoading: isLoading && i === messages.length - 1 && msg.role === 'assistant',
    }));

    if (ocrMessages.length === 0) {
      return chatEntries;
    }

    const ocrEntries: UnifiedMsg[] = ocrMessages.map((msg) =>
      msg.type === 'user'
        ? {
            kind: 'ocr-user',
            id: msg.id,
            type: 'user',
            groupId: msg.groupId,
            content: msg.content,
            imageUrl: msg.imageUrl,
            time: msg.createdAt,
          }
        : {
            kind: 'ocr-result',
            id: msg.id,
            type: 'ocr-result',
            groupId: msg.groupId,
            content: msg.content,
            parsedJson: msg.parsedJson,
            imageUrl: msg.imageUrl,
            time: msg.createdAt,
            ocrStatus: msg.groupId ? (ocrResultStatuses[msg.groupId] ?? 'done') : 'done',
          },
    );

    return [...chatEntries, ...ocrEntries].sort((a, b) => a.time - b.time);
  }, [messages, ocrMessages, chatTimestamps, isLoading, ocrResultStatuses]);

  const hasMessages = unifiedMessages.length > 0;

  if (!chatRuntimeHydrated || !ocrRuntimeHydrated) {
    return (
      <div className="pm-anime-bg flex h-[100dvh] flex-col items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--pm-muted)]" />
      </div>
    );
  }

  return (
    <div className="pm-anime-bg flex h-[100dvh] flex-col overflow-hidden text-[var(--pm-ink)]">
      <ChatTopBar onMenuClick={() => setSidebarOpen(true)} />

      <main
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleUserScrollIntent}
        onTouchMove={handleUserScrollIntent}
        onPointerDown={handleUserScrollIntent}
        className="flex-1 overflow-y-auto hide-scrollbar"
      >
        {hasMessages ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4">
            {unifiedMessages.map((msg) => {
              if (msg.kind === 'chat') {
                return (
                  <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    username={currentUser?.username || '我'}
                    isLoading={msg.isLoading}
                  />
                );
              }
              if (msg.kind === 'ocr-user') {
                return (
                  <OcrBubble
                    key={msg.id}
                    type="user"
                    content={msg.content}
                    imageUrl={msg.imageUrl}
                    username={currentUser?.username || '我'}
                    onImageClick={(url) => setPreviewImage(url)}
                  />
                );
              }
              const structuredResult =
                msg.content && msg.ocrStatus !== 'streaming'
                  ? getStructuredResultFromOcrRecord({
                      content: msg.content,
                      parsedJson: msg.parsedJson,
                    })
                  : null;
              const primaryQuestion = structuredResult
                ? getPrimaryOcrQuestion(structuredResult)
                : null;
              const saveSourceGroupId =
                primaryQuestion
                  ? getQuestionSaveSourceGroupId(msg.groupId, primaryQuestion.id)
                  : msg.groupId;
              const savedWrongQuestionId =
                (saveSourceGroupId ? savedWrongQuestionIdsByGroup[saveSourceGroupId] : undefined) ??
                (msg.groupId ? savedWrongQuestionIdsByGroup[msg.groupId] : undefined);
              const isSaved = Boolean(
                (saveSourceGroupId && savedWrongGroupIds.has(saveSourceGroupId)) ||
                  (msg.groupId && savedWrongGroupIds.has(msg.groupId)),
              );
              const saveError =
                (saveSourceGroupId ? saveWrongErrors[saveSourceGroupId] : undefined) ??
                (msg.groupId ? saveWrongErrors[msg.groupId] : undefined);

              return (
                <OcrBubble
                  key={msg.id}
                  type="ocr-result"
                  content={msg.content}
                  parsedJson={msg.parsedJson}
                  username={currentUser?.username || '我'}
                  onImageClick={(url) => setPreviewImage(url)}
                  ocrStatus={msg.ocrStatus}
                  isSaved={isSaved}
                  savedWrongQuestionId={savedWrongQuestionId}
                  saveError={saveError}
                  onSave={() =>
                    prepareWrongQuestionSave({
                      id: msg.id,
                      userId,
                      type: 'ocr-result',
                      groupId: msg.groupId,
                      content: msg.content,
                      parsedJson: msg.parsedJson,
                      imageUrl: msg.imageUrl,
                      createdAt: msg.time,
                    }).catch((error) => {
                      const errorKey = saveSourceGroupId ?? msg.groupId;
                      if (!errorKey) return;
                      setSaveWrongErrors((prev) => ({
                        ...prev,
                        [errorKey]:
                          error instanceof Error ? error.message : '保存失败，请稍后重试',
                      }));
                    })
                  }
                />
              );
            })}
            {/* Streaming indicator: assistant placeholder not yet in messages */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <ChatBubble role="assistant" content="" username="" isLoading />
            )}
            {chatError && <ChatErrorNotice message={chatError} />}
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-12 text-center">
            <div className="pm-mascot-float flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-[#fff7d6] text-3xl font-black text-[#247269] shadow-sm ring-1 ring-[#f3e6a8]">
              学
            </div>
            <h1 className="mt-5 text-2xl font-black text-[var(--pm-ink)]">你好，我是 PrepMind 👋</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--pm-muted)]">
              你的 AI 备考助手，随时为你解答
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <QuickTag
                label="📷 拍照识题"
                onSelect={() => handleQuickSend('请帮我讲解拍照识题功能怎么用')}
              />
              <QuickTag
                label="📝 错题复习"
                onSelect={() => handleQuickSend('帮我制定一个错题复习计划')}
              />
              <QuickTag
                label="📊 学习计划"
                onSelect={() => handleQuickSend('帮我制定今天的学习计划')}
              />
              <QuickTag
                label="💡 知识讲解"
                onSelect={() => handleQuickSend('用简单的方式讲解一下深度学习的基本概念')}
              />
            </div>
            {chatError && <ChatErrorNotice message={chatError} />}
          </div>
        )}
      </main>

      <form
        ref={formRef}
        data-chat-form
        onSubmit={(e) => {
          if (isGenerating) {
            e.preventDefault();
            return;
          }

          if (selectedImage) {
            e.preventDefault();
            handleOcrSubmit();
          } else {
            setChatError(null);
            scrollToBottom({ force: true });
            handleSubmit(e);
          }
        }}
      >
        <ChatInputBar
          input={input}
          onInputChange={handleInputChange}
          selectedImage={selectedImage}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          isGenerating={isGenerating}
          onStop={handleStopGeneration}
        />
      </form>

      <ChatSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <Image
            src={previewImage}
            alt="图片预览"
            width={1200}
            height={1200}
            unoptimized
            className="max-h-[90vh] max-w-[95vw] object-contain"
          />
        </div>
      )}

      {pendingWrongQuestion && (
        <WrongQuestionSaveDialog
          pending={pendingWrongQuestion}
          saving={confirmSaving}
          onCancel={() => setPendingWrongQuestion(null)}
          onConfirm={() => void confirmWrongQuestionSave()}
        />
      )}
    </div>
  );
}

// ─── ChatBubble (memo'd) ────────────────────────────────────────────

const ChatBubble = memo(function ChatBubble({
  role,
  content,
  username,
  isLoading,
}: {
  role: 'user' | 'assistant';
  content: string;
  username: string;
  isLoading?: boolean;
}) {
  const isUser = role === 'user';
  const deferredContent = useDeferredValue(content);
  const renderContent = isLoading ? deferredContent : content;
  const displayContent = useMemo(
    () => formatChatAssistantContent(renderContent),
    [renderContent],
  );

  return (
    <div className={`pm-bubble-in flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${
          isUser
            ? 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]'
            : 'bg-white/80 text-[var(--pm-muted)] ring-[var(--pm-line)]'
        }`}
      >
        {isUser ? username[0]?.toUpperCase() : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'rounded-tr-md bg-[#a7e4d8] text-[#23433f] ring-1 ring-[#79d3c5]/60'
            : 'rounded-tl-md border border-[var(--pm-line)] bg-white/88 text-[var(--pm-ink)]'
        }`}
      >
        {isUser ? (
          <span>{content}</span>
        ) : isLoading && !content ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : isLoading ? (
          <StreamingMarkdownRenderer content={displayContent} />
        ) : (
          <MarkdownRenderer content={displayContent} />
        )}
      </div>
    </div>
  );
});

// ─── QuickTag ───────────────────────────────────────────────────────

function QuickTag({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-full border border-[var(--pm-line)] bg-white/75 px-4 py-2 text-sm font-semibold text-[var(--pm-ink)] transition-all hover:bg-[#eafff9] active:scale-95"
    >
      {label}
    </button>
  );
}

function ChatErrorNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-2 max-w-[85%] rounded-2xl border border-red-100 bg-red-50/90 px-3 py-2 text-xs leading-5 text-red-700">
      {message}
    </div>
  );
}

// ─── OcrBubble ──────────────────────────────────────────────────────

const OcrBubble = memo(function OcrBubble({
  type,
  content,
  parsedJson,
  imageUrl,
  username,
  onImageClick,
  onSave,
  ocrStatus = 'done',
  isSaved,
  savedWrongQuestionId,
  saveError,
}: {
  type: 'user' | 'ocr-loading' | 'ocr-result';
  content: string;
  parsedJson?: OcrRecord['parsedJson'];
  imageUrl?: string;
  username: string;
  onImageClick?: (url: string) => void;
  onSave?: () => Promise<void>;
  ocrStatus?: OcrResultStatus;
  isSaved?: boolean;
  savedWrongQuestionId?: string;
  saveError?: string;
}) {
  const [saving, setSaving] = useState(false);
  const isStreaming = ocrStatus === 'streaming';
  const deferredContent = useDeferredValue(content);
  const renderContent = isStreaming ? deferredContent : content;
  const structuredOcr = useMemo(
    () =>
      type === 'ocr-result' && content && !isStreaming
        ? getStructuredResultFromOcrRecord({ content, parsedJson })
        : null,
    [content, isStreaming, parsedJson, type],
  );
  const primaryQuestion = useMemo(
    () => (structuredOcr ? getPrimaryOcrQuestion(structuredOcr) : null),
    [structuredOcr],
  );
  const displayContent = useMemo(
    () =>
      isStreaming
        ? formatStreamingOcrContent(renderContent)
        : getDisplayMarkdownFromOcrContent(renderContent),
    [isStreaming, renderContent],
  );
  const canSave =
    ocrStatus === 'done' && primaryQuestion ? canSaveStructuredQuestion(primaryQuestion) : false;
  const missingFields = primaryQuestion?.warnings ?? [];

  const handleSave = async () => {
    if (!onSave || saving || isSaved || !canSave) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  if (type === 'user') {
    return (
      <div className="pm-bubble-in flex flex-col items-end gap-1.5">
        <div className="flex flex-row-reverse gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eafff9] text-xs font-semibold text-[#247269] ring-1 ring-[#bdeee5]">
            {username[0]?.toUpperCase()}
          </div>
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="发送的图片"
              width={280}
              height={208}
              unoptimized
              onClick={() => onImageClick?.(imageUrl)}
              className="max-h-52 max-w-[70%] cursor-pointer rounded-2xl object-cover shadow-sm ring-1 ring-[var(--pm-line)]"
            />
          )}
        </div>
        {content && (
          <div className="flex flex-row-reverse gap-2.5">
            <div className="w-8 shrink-0" />
            <div className="max-w-[82%] rounded-2xl rounded-tr-md bg-[#a7e4d8] px-4 py-2.5 text-sm leading-relaxed text-[#23433f] shadow-sm ring-1 ring-[#79d3c5]/60">
              <span>{content}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ocr-result
  return (
    <div className="pm-bubble-in flex gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[86%] rounded-2xl rounded-tl-md border border-[var(--pm-line)] bg-white/88 px-4 py-3 text-sm leading-relaxed text-[var(--pm-ink)] shadow-sm">
        {content ? (
          <>
            {isStreaming ? (
              <StreamingMarkdownRenderer content={displayContent} />
            ) : (
              <MarkdownRenderer content={displayContent} />
            )}
            {(canSave || isSaved) && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || isSaved}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-[#bdeee5] bg-[#eafff9] px-3 py-2 text-xs font-semibold text-[#247269] transition-all hover:bg-[#d8f8f0] active:scale-[0.98] disabled:border-[var(--pm-line)] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:active:scale-100"
              >
                {isSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    已保存到错题本
                  </>
                ) : saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在保存
                  </>
                ) : (
                  '保存到错题本'
                )}
              </button>
            )}
            {ocrStatus === 'streaming' && (
              <p className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-xs text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
                正在识别图片内容...
              </p>
            )}
            {ocrStatus === 'done' && primaryQuestion && !canSave && missingFields.length > 0 && (
              <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                识别结果缺少：{formatMissingWrongQuestionFields(missingFields)}，暂不能保存到错题本。
                建议重新识别或补充更清晰的图片。
              </p>
            )}
            {ocrStatus === 'aborted' && (
              <p className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-xs text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
                已停止本次识别。
              </p>
            )}
            {ocrStatus === 'failed' && (
              <p className="mt-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                本次识别失败，可以重新上传图片再试。
              </p>
            )}
            {isSaved && (
              <div className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 font-medium">已加入错题本</span>
                </div>
                <Link
                  href={getWrongQuestionFocusHref(savedWrongQuestionId)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#2b2335] px-2.5 text-xs font-semibold text-white transition-transform active:scale-95"
                >
                  查看
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
            {saveError && <p className="mt-2 text-xs text-destructive">{saveError}</p>}
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">正在识别题目...</span>
          </div>
        )}
      </div>
    </div>
  );
});

function WrongQuestionSaveDialog({
  pending,
  saving,
  onCancel,
  onConfirm,
}: {
  pending: PendingWrongQuestionSave;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const missingLabels: Record<string, string> = {
    questionText: '题目',
    knowledgePoints: '知识点',
    analysis: '分析思路',
    answer: '参考答案',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#2b2335]/30 backdrop-blur-[2px] sm:items-center sm:justify-center">
      <div className="pm-glass-card max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.5rem] p-4 shadow-xl sm:max-w-md sm:rounded-[1.5rem]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">保存到错题本</h2>
            <p className="mt-1 text-xs text-muted-foreground">确认字段后再保存，后续可在错题详情里修改备注。</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/75 ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {pending.missingFields.length > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            AI 识别提醒：
            {pending.missingFields.map((field) => missingLabels[field] ?? field).join('、')}。
            仍可保存，但建议稍后补充。
          </div>
        )}

        {pending.imageUrl && (
          <Image
            src={pending.imageUrl}
            alt="错题图片预览"
            width={640}
            height={360}
            unoptimized
            className="mt-3 max-h-48 w-full rounded-2xl bg-white/60 object-contain ring-1 ring-[var(--pm-line)]"
          />
        )}

        <div className="mt-3 space-y-3">
          <PreviewField label="题目" value={pending.question.questionText} renderMarkdown />
          <div className="grid grid-cols-2 gap-2">
            <PreviewPill label="学科" value={pending.question.subject} />
            <PreviewPill label="错因" value={pending.question.errorSuggestion} />
          </div>
          {pending.question.knowledgePoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">知识点</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {pending.question.knowledgePoints.map((point) => (
                  <span
                    key={point}
                    className="pm-soft-chip rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>
          )}
          <PreviewField label="参考答案" value={pending.question.answer} renderMarkdown />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="tap-target flex min-h-11 items-center justify-center rounded-2xl border border-[var(--pm-line)] bg-white/75 text-sm font-semibold transition-all hover:bg-white active:scale-[0.98] disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="tap-target flex min-h-11 items-center justify-center rounded-2xl bg-[#86dccf] text-sm font-semibold text-[#173b37] transition-all hover:bg-[#70cfc1] active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)]"
          >
            {saving ? '保存中...' : '确认保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewField({
  label,
  value,
  renderMarkdown,
}: {
  label: string;
  value: string;
  renderMarkdown?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--pm-muted)]">{label}</p>
      <div className="mt-1 max-h-36 overflow-y-auto rounded-2xl bg-white/70 px-3 py-2 text-sm leading-6 ring-1 ring-[var(--pm-line)]">
        {value ? (
          renderMarkdown ? (
            <MarkdownRenderer content={formatWrongQuestionFieldForDisplay(value)} />
          ) : (
            value
          )
        ) : (
          '未识别'
        )}
      </div>
    </div>
  );
}

function PreviewPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <p className="text-[11px] text-[var(--pm-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value || '未识别'}</p>
    </div>
  );
}
