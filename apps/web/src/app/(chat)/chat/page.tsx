'use client';

import { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
import { useCreateWrongQuestion } from '@/hooks/use-wrong-questions';
import { useStreamingAutoScroll } from '@/hooks/use-streaming-auto-scroll';
import {
  canSaveOcrResult,
  formatOcrContentForDisplay,
  formatStreamingOcrContent,
  getMissingWrongQuestionFields,
  parseOcrResult,
  type OcrResultStatus,
  type ParsedWrongQuestion,
} from '@/lib/wrong-question-parser';
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
      time: number;
      ocrStatus: OcrResultStatus;
    };

type PendingWrongQuestionSave = {
  result: OcrRecord;
  parsed: ParsedWrongQuestion;
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

// ─── Parent: gate by current user, runtime providers hydrate data ───

export default function ChatPage() {
  const currentUser = useUserStore((s) => s.currentUser);
  const userId = currentUser?.id ?? null;

  if (!userId) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  const prepareWrongQuestionSave = useCallback(async (result: OcrRecord) => {
    const ownerId = getScopedUserId({ id: userId });
    if (!result.content.trim()) return;

    const sourceGroupId = result.groupId;
    if (sourceGroupId) {
      const existing = await db.wrongQuestions
        .where('[userId+sourceGroupId]')
        .equals([ownerId, sourceGroupId])
        .first();
      if (existing) {
        setSavedWrongGroupIds((prev) => new Set(prev).add(sourceGroupId));
        setSavedWrongQuestionIdsByGroup((prev) => ({
          ...prev,
          [sourceGroupId]: existing.id,
        }));
        setSaveWrongErrors((prev) => {
          const next = { ...prev };
          delete next[sourceGroupId];
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
    const parsed = parseOcrResult(result.content);
    const ocrStatus = sourceGroupId ? (ocrResultStatuses[sourceGroupId] ?? 'done') : 'done';
    const missingFields = getMissingWrongQuestionFields(parsed);

    if (!canSaveOcrResult(parsed, ocrStatus)) {
      if (sourceGroupId) {
        setSaveWrongErrors((prev) => ({
          ...prev,
          [sourceGroupId]: !parsed.isQuestion
            ? '未识别到题目，不能保存到错题本'
            : ocrStatus !== 'done'
              ? '识别完成后才能保存到错题本'
              : `识别结果缺少：${formatMissingWrongQuestionFields(missingFields)}，请重新识别后再保存`,
        }));
      }
      return;
    }

    setPendingWrongQuestion({
      result,
      parsed,
      imageUrl: result.imageUrl ?? relatedUser?.imageUrl,
      sourceGroupId,
      missingFields,
    });
  }, [ocrMessages, ocrResultStatuses, userId]);

  const confirmWrongQuestionSave = useCallback(async () => {
    if (!pendingWrongQuestion || confirmSaving) return;

    const ownerId = getScopedUserId({ id: userId });
    const { result, parsed, imageUrl, sourceGroupId } = pendingWrongQuestion;
    const now = Date.now();
    const record: WrongQuestionRecord = {
      id: crypto.randomUUID(),
      userId: ownerId,
      source: 'ocr',
      sourceRecordId: result.id,
      sourceGroupId,
      imageUrl,
      questionText: parsed.questionText,
      subject: parsed.subject,
      category: parsed.category,
      knowledgePoints: parsed.knowledgePoints,
      analysis: parsed.analysis,
      answer: parsed.answer,
      errorType: parsed.errorType,
      userNote: '',
      rawContent: parsed.rawContent,
      status: 'unresolved',
      createdAt: now,
      updatedAt: now,
    };

    setConfirmSaving(true);
    try {
      const savedRecord = await createWrongQuestion.mutateAsync(record);
      await db.wrongQuestions.put({
        ...savedRecord,
        imageUrl: savedRecord.imageUrl ?? record.imageUrl,
      });
      if (sourceGroupId) {
        setSavedWrongGroupIds((prev) => new Set(prev).add(sourceGroupId));
        setSavedWrongQuestionIdsByGroup((prev) => ({
          ...prev,
          [sourceGroupId]: savedRecord.id,
        }));
        setSaveWrongErrors((prev) => {
          const next = { ...prev };
          delete next[sourceGroupId];
          return next;
        });
      }
      setPendingWrongQuestion(null);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'WRONG_QUESTION_DUPLICATED') {
        if (sourceGroupId) {
          setSavedWrongGroupIds((prev) => new Set(prev).add(sourceGroupId));
          setSaveWrongErrors((prev) => {
            const next = { ...prev };
            delete next[sourceGroupId];
            return next;
          });
        }
        setPendingWrongQuestion(null);
        return;
      }

      if (sourceGroupId) {
        setSaveWrongErrors((prev) => ({
          ...prev,
          [sourceGroupId]: error instanceof Error ? error.message : '保存失败，请稍后重试',
        }));
      }
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
            time: msg.createdAt,
            ocrStatus: msg.groupId ? (ocrResultStatuses[msg.groupId] ?? 'done') : 'done',
          },
    );

    return [...chatEntries, ...ocrEntries].sort((a, b) => a.time - b.time);
  }, [messages, ocrMessages, chatTimestamps, isLoading, ocrResultStatuses]);

  const hasMessages = unifiedMessages.length > 0;

  if (!chatRuntimeHydrated || !ocrRuntimeHydrated) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
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
          <div className="flex flex-col gap-3 px-4 py-4">
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
              return (
                <OcrBubble
                  key={msg.id}
                  type="ocr-result"
                  content={msg.content}
                  username={currentUser?.username || '我'}
                  onImageClick={(url) => setPreviewImage(url)}
                  ocrStatus={msg.ocrStatus}
                  isSaved={Boolean(msg.groupId && savedWrongGroupIds.has(msg.groupId))}
                  savedWrongQuestionId={
                    msg.groupId ? savedWrongQuestionIdsByGroup[msg.groupId] : undefined
                  }
                  saveError={msg.groupId ? saveWrongErrors[msg.groupId] : undefined}
                  onSave={() =>
                    prepareWrongQuestionSave({
                      id: msg.id,
                      userId,
                      type: 'ocr-result',
                      groupId: msg.groupId,
                      content: msg.content,
                      createdAt: msg.time,
                    }).catch((error) => {
                      if (!msg.groupId) return;
                      setSaveWrongErrors((prev) => ({
                        ...prev,
                        [msg.groupId as string]:
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
          <div className="flex flex-col items-center px-4 pt-12">
            <h1 className="text-xl font-bold">你好，我是 PrepMind 👋</h1>
            <p className="mt-2 text-sm text-muted-foreground">你的 AI 备考助手，随时为你解答</p>
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
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {isUser ? username[0]?.toUpperCase() : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-md'
            : 'bg-muted text-foreground rounded-tl-md'
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
      className="rounded-full border border-border bg-muted/50 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted active:scale-95"
    >
      {label}
    </button>
  );
}

function ChatErrorNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-2 max-w-[85%] rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
      {message}
    </div>
  );
}

// ─── OcrBubble ──────────────────────────────────────────────────────

const OcrBubble = memo(function OcrBubble({
  type,
  content,
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
  const parsedOcr = useMemo(
    () => (type === 'ocr-result' && content && !isStreaming ? parseOcrResult(content) : null),
    [content, isStreaming, type],
  );
  const displayContent = useMemo(
    () =>
      isStreaming
        ? formatStreamingOcrContent(renderContent)
        : formatOcrContentForDisplay(renderContent),
    [isStreaming, renderContent],
  );
  const canSave = parsedOcr ? canSaveOcrResult(parsedOcr, ocrStatus) : false;
  const missingFields = parsedOcr ? getMissingWrongQuestionFields(parsedOcr) : [];

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
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-row-reverse gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
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
              className="max-h-52 max-w-[70%] cursor-pointer rounded-2xl object-cover"
            />
          )}
        </div>
        {content && (
          <div className="flex flex-row-reverse gap-2.5">
            <div className="w-8 shrink-0" />
            <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
              <span>{content}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ocr-result
  return (
    <div className="flex gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
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
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.98] disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:active:scale-100"
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
              <p className="mt-2 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                正在识别图片内容...
              </p>
            )}
            {ocrStatus === 'done' && parsedOcr?.isQuestion && !canSave && missingFields.length > 0 && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                识别结果缺少：{formatMissingWrongQuestionFields(missingFields)}，暂不能保存到错题本。
                建议重新识别或补充更清晰的图片。
              </p>
            )}
            {ocrStatus === 'aborted' && (
              <p className="mt-2 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                已停止本次识别。
              </p>
            )}
            {ocrStatus === 'failed' && (
              <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                本次识别失败，可以重新上传图片再试。
              </p>
            )}
            {isSaved && (
              <div className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-primary/20 bg-background px-3 py-2 text-xs text-foreground shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 font-medium">已加入错题本</span>
                </div>
                <Link
                  href={getWrongQuestionFocusHref(savedWrongQuestionId)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-transform active:scale-95"
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
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center">
      <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">保存到错题本</h2>
            <p className="mt-1 text-xs text-muted-foreground">确认字段后再保存，后续可在错题详情里修改备注。</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {pending.missingFields.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            AI 输出缺少：
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
            className="mt-3 max-h-48 w-full rounded-lg object-contain ring-1 ring-border"
          />
        )}

        <div className="mt-3 space-y-3">
          <PreviewField label="题目" value={pending.parsed.questionText} renderMarkdown />
          <div className="grid grid-cols-2 gap-2">
            <PreviewPill label="学科" value={pending.parsed.subject} />
            <PreviewPill label="错因" value={pending.parsed.errorType} />
          </div>
          {pending.parsed.knowledgePoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">知识点</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {pending.parsed.knowledgePoints.map((point) => (
                  <span
                    key={point}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>
          )}
          <PreviewField label="参考答案" value={pending.parsed.answer} renderMarkdown />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="tap-target flex min-h-11 items-center justify-center rounded-lg border border-border text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="tap-target flex min-h-11 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground"
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
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 max-h-36 overflow-y-auto rounded-lg bg-muted/50 px-3 py-2 text-sm leading-6">
        {value ? renderMarkdown ? <MarkdownRenderer content={value} /> : value : '未识别'}
      </div>
    </div>
  );
}

function PreviewPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value || '未识别'}</p>
    </div>
  );
}
