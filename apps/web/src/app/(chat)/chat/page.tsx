'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { useChat } from '@ai-sdk/react';
import ChatTopBar from '@/components/chat/chat-top-bar';
import ChatSidebar from '@/components/chat/chat-sidebar';
import ChatInputBar from '@/components/chat/chat-input-bar';
import type { SelectedImage } from '@/components/chat/chat-input-bar';
import { useUserStore } from '@/stores/userStore';
import { useChatStore } from '@/stores/chatStore';
import { db } from '@/lib/db';
import type { StoredMessage, OcrRecord, WrongQuestionRecord } from '@/lib/db';
import { formatOcrContentForDisplay, parseOcrResult } from '@/lib/wrong-question-parser';
import { Bot, Check, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPlugins = [remarkGfm];
const SCROLL_THRESHOLD = 100;

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
    };

// ─── Parent: load from Dexie, then mount ChatView ───────────────────

export default function ChatPage() {
  const [loadedMessages, setLoadedMessages] = useState<StoredMessage[] | null>(null);
  const [loadedOcr, setLoadedOcr] = useState<OcrRecord[] | null>(null);

  useEffect(() => {
    db.messages.orderBy('order').toArray().then(setLoadedMessages);
    db.ocrRecords.orderBy('createdAt').toArray().then(setLoadedOcr);
  }, []);

  if (loadedMessages === null || loadedOcr === null) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <ChatView initialMessages={loadedMessages} initialOcrRecords={loadedOcr} />;
}

// ─── ChatView: main chat UI ─────────────────────────────────────────

function ChatView({
  initialMessages: persistedMessages,
  initialOcrRecords: persistedOcr,
}: {
  initialMessages: StoredMessage[];
  initialOcrRecords: OcrRecord[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentUser = useUserStore((s) => s.currentUser);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isAutoScrollRef = useRef(true);
  const rafRef = useRef<number>(0);

  const { inputDraft, setInputDraft, clearInputDraft } = useChatStore();

  // ── UI state ──
  const initialLoadDoneRef = useRef(false);
  const messagesSavedRef = useRef(false);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrMessages, setOcrMessages] = useState<OcrRecord[]>(persistedOcr);
  const [savedWrongGroupIds, setSavedWrongGroupIds] = useState<Set<string>>(new Set());
  const [saveWrongErrors, setSaveWrongErrors] = useState<Record<string, string>>({});

  // ── Chat message timestamps (for unified ordering in-session) ──
  const [chatTimestamps, setChatTimestamps] = useState<Record<string, number>>(() => {
    // Initialize from persisted messages
    const ts: Record<string, number> = {};
    for (const m of persistedMessages) {
      ts[m.id] = m.createdAt ?? Date.now();
    }
    return ts;
  });
  const chatTimestampsRef = useRef(chatTimestamps);

  const handleImageSelect = useCallback((img: SelectedImage) => {
    setSelectedImage(img);
  }, []);

  const handleImageRemove = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const { messages, handleInputChange, handleSubmit, input, setInput, isLoading } = useChat({
    api: '/api/chat',
    initialInput: inputDraft,
    initialMessages: persistedMessages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // ── Refs (kept in sync via useLayoutEffect) ──
  const messagesRef = useRef(messages);
  const ocrMsgRef = useRef(ocrMessages);
  useLayoutEffect(() => {
    messagesRef.current = messages;
    ocrMsgRef.current = ocrMessages;
    chatTimestampsRef.current = chatTimestamps;
  });

  useEffect(() => {
    db.wrongQuestions.toArray().then((items) => {
      setSavedWrongGroupIds(
        new Set(items.map((item) => item.sourceGroupId).filter(Boolean) as string[]),
      );
    });
  }, []);

  // ── Track chat message creation timestamps ──
  const prevMsgIdsRef = useRef<Set<string>>(new Set(persistedMessages.map((m) => m.id)));
  useEffect(() => {
    const currentIds = new Set(messages.map((m) => m.id));
    let changed = false;
    const ts = { ...chatTimestampsRef.current };
    for (const msg of messages) {
      if (!prevMsgIdsRef.current.has(msg.id)) {
        ts[msg.id] = Date.now();
        changed = true;
      }
    }
    prevMsgIdsRef.current = currentIds;
    if (changed) setChatTimestamps(ts);
  }, [messages]);

  // ── Direct Dexie save helpers (no TanStack Query) ──
  const saveChatToDb = useCallback(async (msgs: StoredMessage[]) => {
    await db.transaction('rw', db.messages, async () => {
      await db.messages.clear();
      await db.messages.bulkAdd(msgs);
    });
  }, []);

  const saveOcrToDb = useCallback(async (records: OcrRecord[]) => {
    await db.transaction('rw', db.ocrRecords, async () => {
      await db.ocrRecords.clear();
      await db.ocrRecords.bulkAdd(records);
    });
  }, []);

  // ── Persist chat messages to Dexie (skip first load) ──
  useEffect(() => {
    if (!messagesSavedRef.current) {
      messagesSavedRef.current = true;
      return;
    }
    const msgs = messagesRef.current;
    if (msgs.length > 0) {
      const ts = chatTimestampsRef.current;
      saveChatToDb(
        msgs.map((m, i) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          order: i,
          createdAt: ts[m.id] ?? Date.now(),
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isLoading]);

  // ── Page close / visibility change → force save ──
  useEffect(() => {
    const flush = () => {
      const msgs = messagesRef.current;
      if (msgs.length > 0) {
        const ts = chatTimestampsRef.current;
        const stored = msgs.map((m, i) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          order: i,
          createdAt: ts[m.id] ?? Date.now(),
        }));
        db.transaction('rw', db.messages, async () => {
          await db.messages.clear();
          await db.messages.bulkAdd(stored);
        });
      }
      const ocr = ocrMsgRef.current;
      if (ocr.length > 0) {
        db.transaction('rw', db.ocrRecords, async () => {
          await db.ocrRecords.clear();
          await db.ocrRecords.bulkAdd(ocr);
        });
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // ── Message count change → clear input draft (skip initial load) ──
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }
    clearInputDraft();
  }, [messages.length, clearInputDraft]);

  // ── Input binding ──
  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(e);
      setInputDraft(e.target.value);
    },
    [handleInputChange, setInputDraft],
  );

  // ── Scroll ──
  const scrollToBottom = useCallback(() => {
    isAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    isAutoScrollRef.current = isAtBottom;
  }, []);

  useEffect(() => {
    if (!isAutoScrollRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [messages, isLoading]);

  // ── OCR submit ──
  const handleOcrSubmit = useCallback(async () => {
    if (!selectedImage || ocrLoading) return;

    const userText = input.trim();
    const groupId = `ocr-${Date.now()}`;
    const userMsgId = `${groupId}-user`;
    const resultMsgId = `${groupId}-result`;
    const imgUrl = selectedImage.previewUrl;

    const initialOcrMsgs: OcrRecord[] = [
      ...ocrMsgRef.current,
      {
        id: userMsgId,
        type: 'user',
        groupId,
        content: userText,
        imageUrl: imgUrl,
        createdAt: Date.now(),
      },
      { id: resultMsgId, type: 'ocr-result', groupId, content: '', createdAt: Date.now() + 1 },
    ];
    setOcrMessages(initialOcrMsgs);

    const img = selectedImage;
    setSelectedImage(null);
    setInput('');
    clearInputDraft();
    scrollToBottom();
    setOcrLoading(true);

    try {
      const fd = new FormData();
      fd.append('image', img.file);
      if (userText) fd.append('text', userText);

      const res = await fetch('/api/ocr', { method: 'POST', body: fd });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '识别失败');
      }

      // Stream SSE
      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              setOcrMessages((prev) =>
                prev.map((m) => (m.id === resultMsgId ? { ...m, content: fullContent } : m)),
              );
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      // Save: use fullContent (authoritative) to patch the ref's final state
      const finalOcr = ocrMsgRef.current.map((m) =>
        m.id === resultMsgId ? { ...m, content: fullContent } : m,
      );
      saveOcrToDb(finalOcr);
    } catch (err) {
      const errMsg = `识别失败：${err instanceof Error ? err.message : '未知错误'}`;
      setOcrMessages((prev) =>
        prev.map((m) => (m.id === resultMsgId ? { ...m, content: errMsg } : m)),
      );
      const finalOcr = ocrMsgRef.current.map((m) =>
        m.id === resultMsgId ? { ...m, content: errMsg } : m,
      );
      saveOcrToDb(finalOcr);
    } finally {
      setOcrLoading(false);
    }
  }, [selectedImage, ocrLoading, input, setInput, clearInputDraft, scrollToBottom, saveOcrToDb]);

  const handleQuickSend = useCallback(
    (text: string) => {
      setInput(text);
      scrollToBottom();
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    },
    [setInput, scrollToBottom],
  );

  const handleSaveWrongQuestion = useCallback(async (result: OcrRecord) => {
    if (!result.content.trim()) return;

    const sourceGroupId = result.groupId;
    if (sourceGroupId) {
      const existing = await db.wrongQuestions
        .filter((item) => item.sourceGroupId === sourceGroupId)
        .first();
      if (existing) {
        setSavedWrongGroupIds((prev) => new Set(prev).add(sourceGroupId));
        setSaveWrongErrors((prev) => {
          const next = { ...prev };
          delete next[sourceGroupId];
          return next;
        });
        return;
      }
    }

    const relatedUser = sourceGroupId
      ? ocrMsgRef.current.find((msg) => msg.type === 'user' && msg.groupId === sourceGroupId)
      : [...ocrMsgRef.current]
          .reverse()
          .find((msg) => msg.type === 'user' && msg.createdAt <= result.createdAt);
    const parsed = parseOcrResult(result.content);
    const now = Date.now();
    const record: WrongQuestionRecord = {
      id: crypto.randomUUID(),
      source: 'ocr',
      sourceRecordId: result.id,
      sourceGroupId,
      imageUrl: relatedUser?.imageUrl,
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

    await db.wrongQuestions.add(record);
    if (sourceGroupId) {
      setSavedWrongGroupIds((prev) => new Set(prev).add(sourceGroupId));
      setSaveWrongErrors((prev) => {
        const next = { ...prev };
        delete next[sourceGroupId];
        return next;
      });
    }
  }, []);

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
          },
    );

    return [...chatEntries, ...ocrEntries].sort((a, b) => a.time - b.time);
  }, [messages, ocrMessages, chatTimestamps, isLoading]);

  const hasMessages = unifiedMessages.length > 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <ChatTopBar onMenuClick={() => setSidebarOpen(true)} />

      <main
        ref={scrollRef}
        onScroll={handleScroll}
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
                  isSaved={Boolean(msg.groupId && savedWrongGroupIds.has(msg.groupId))}
                  saveError={msg.groupId ? saveWrongErrors[msg.groupId] : undefined}
                  onSave={() =>
                    handleSaveWrongQuestion({
                      id: msg.id,
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
          </div>
        )}
      </main>

      <form
        ref={formRef}
        data-chat-form
        onSubmit={(e) => {
          if (selectedImage) {
            e.preventDefault();
            handleOcrSubmit();
          } else {
            handleSubmit(e);
          }
        }}
      >
        <ChatInputBar
          input={input}
          onInputChange={onInputChange}
          selectedImage={selectedImage}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
        />
      </form>

      <ChatSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="图片预览"
            className="max-h-[90vh] max-w-[95vw] object-contain"
          />
        </div>
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
        ) : (
          <>
            <div className="markdown-body">
              <Markdown remarkPlugins={remarkPlugins}>{content}</Markdown>
            </div>
            {isLoading && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground" />
            )}
          </>
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

// ─── OcrBubble ──────────────────────────────────────────────────────

function OcrBubble({
  type,
  content,
  imageUrl,
  username,
  onImageClick,
  onSave,
  isSaved,
  saveError,
}: {
  type: 'user' | 'ocr-loading' | 'ocr-result';
  content: string;
  imageUrl?: string;
  username: string;
  onImageClick?: (url: string) => void;
  onSave?: () => Promise<void>;
  isSaved?: boolean;
  saveError?: string;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave || saving || isSaved) return;
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
            <img
              src={imageUrl}
              alt="发送的图片"
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
            <div className="markdown-body">
              <Markdown remarkPlugins={remarkPlugins}>
                {formatOcrContentForDisplay(content)}
              </Markdown>
            </div>
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
}
