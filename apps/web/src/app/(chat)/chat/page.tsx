"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, memo } from "react";
import { useChat } from "@ai-sdk/react";
import ChatTopBar from "@/components/chat/chat-top-bar";
import ChatSidebar from "@/components/chat/chat-sidebar";
import ChatInputBar from "@/components/chat/chat-input-bar";
import type { SelectedImage } from "@/components/chat/chat-input-bar";
import { useUserStore } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { usePersistedMessages, useSaveMessages } from "@/hooks/use-messages";
import { useOcrRecords, useSaveOcrRecords } from "@/hooks/use-ocr-records";
import type { OcrRecord } from "@/lib/db";
import { Bot, Loader2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const remarkPlugins = [remarkGfm];
const SCROLL_THRESHOLD = 100;

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentUser = useUserStore((s) => s.currentUser);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isAutoScrollRef = useRef(true);
  const rafRef = useRef<number>(0);

  const { inputDraft, setInputDraft, clearInputDraft } = useChatStore();
  const { data: persistedMessages, isSuccess: messagesReady } = usePersistedMessages();
  const saveMessages = useSaveMessages();
  const { data: persistedOcr } = useOcrRecords();
  const saveOcr = useSaveOcrRecords();
  const initialLoadDoneRef = useRef(false);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrMessages, setOcrMessages] = useState<OcrRecord[]>([]);

  // Dexie 加载完后初始化 OCR 记录
  useEffect(() => {
    if (persistedOcr && persistedOcr.length > 0) {
      setOcrMessages(persistedOcr);
    }
  }, [persistedOcr]);

  const handleImageSelect = useCallback((img: SelectedImage) => {
    setSelectedImage(img);
  }, []);

  const handleImageRemove = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const {
    messages,
    handleInputChange,
    handleSubmit,
    input,// 当前输入框内容 用户打字 -> input 实时变化 -> useEffect同步更新到Zustand的inputDraft
    setInput,
    isLoading,
  } = useChat({
    api: "/api/chat",
    initialInput: inputDraft,
    initialMessages: messagesReady ? persistedMessages : undefined,
  });

  // 用户发送新消息时，强制滚到底部
  const scrollToBottom = useCallback(() => {
    isAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  // 拍照识题：拦截提交，发送图片到 /api/ocr
  const handleOcrSubmit = useCallback(async () => {
    if (!selectedImage || ocrLoading) return;

    const userText = input.trim();
    const userMsgId = `ocr-user-${Date.now()}`;
    const loadingMsgId = `ocr-loading-${Date.now()}`;

    // 显示用户消息 + loading（保存图片 URL 用于展示）
    const imgUrl = selectedImage.previewUrl;
    setOcrMessages((prev) => [
      ...prev,
      { id: userMsgId, type: "user", content: userText, imageUrl: imgUrl, createdAt: Date.now() },
      { id: loadingMsgId, type: "ocr-loading", content: "", createdAt: Date.now() },
    ]);

    // 清空输入
    const img = selectedImage;
    setSelectedImage(null);
    setInput("");
    clearInputDraft();
    scrollToBottom();
    setOcrLoading(true);

    try {
      const fd = new FormData();
      fd.append("image", img.file);
      if (userText) fd.append("text", userText);

      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "识别失败");

      // 替换 loading 为结果
      setOcrMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId
            ? { id: `ocr-result-${Date.now()}`, type: "ocr-result", content: data.result, createdAt: Date.now() }
            : m,
        ),
      );
    } catch (err) {
      setOcrMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsgId
            ? { id: `ocr-err-${Date.now()}`, type: "ocr-result", content: `识别失败：${err instanceof Error ? err.message : "未知错误"}`, createdAt: Date.now() }
            : m,
        ),
      );
    } finally {
      setOcrLoading(false);
    }
  }, [selectedImage, ocrLoading, input, setInput, clearInputDraft, scrollToBottom]);

  // ref 持有最新 messages，供 effect 读取（避免 messages 作为 effect 依赖导致循环）
  const messagesRef = useRef(messages);
  useLayoutEffect(() => {
    messagesRef.current = messages;
  });

  // 持久化聊天消息到 Dexie（消息数量变化 或 AI 回复完成时）
  useEffect(() => {
    const msgs = messagesRef.current;
    if (msgs.length > 0) {
      saveMessages.mutate(
        msgs.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))
      );
    }
  }, [messages.length, isLoading, saveMessages]);

  // 持久化 OCR 记录到 Dexie
  useEffect(() => {
    if (ocrMessages.length > 0) {
      saveOcr.mutate(ocrMessages);
    }
  }, [ocrMessages.length, saveOcr]);

  // 消息数量变化时清空 inputDraft（跳过初始加载）
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }
    clearInputDraft();
  }, [messages.length, clearInputDraft]);

  // 包装 onInputChange，同步到 chatStore
  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(e);// 处理输入框变化，更新 input
      // 同步更新到 Zustand 的 inputDraft
      setInputDraft(e.target.value);
    },
    [handleInputChange, setInputDraft],// 依赖 handleInputChange 和 setInputDraft
  );

  // 检测用户是否手动滚动离开底部
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    isAutoScrollRef.current = isAtBottom;
  }, []);

  // 新消息/流式输出时，仅在用户处于底部时自动滚动（rAF 节流）
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

  const handleQuickSend = useCallback(
    (text: string) => {
      setInput(text);
      scrollToBottom();
      // 等 React 更新 input 后再提交
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    },
    [setInput, scrollToBottom],
  );

  const hasMessages = messages.length > 0 || ocrMessages.length > 0;

  // Dexie 加载完成前显示骨架屏（useChat 需要 initialMessages 在首次渲染时就绪）
  if (!messagesReady) {
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
        className="flex-1 overflow-y-auto hide-scrollbar"
      >
        {/* 显示聊天消息 */}
        {hasMessages ? (
          <div className="flex flex-col gap-3 px-4 py-4">
            {messages.map((msg, i) => (
              <ChatBubble
                key={msg.id}
                role={msg.role as "user" | "assistant"}
                content={msg.content}
                username={currentUser?.username || "我"}
                isLoading={
                  isLoading && i === messages.length - 1 && msg.role === "assistant"
                }
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <ChatBubble role="assistant" content="" username="" isLoading />
            )}
            {/* OCR 识别消息 */}
            {ocrMessages.map((msg) => (
              <OcrBubble
                key={msg.id}
                type={msg.type}
                content={msg.content}
                imageUrl={msg.imageUrl}
                username={currentUser?.username || "我"}
                onImageClick={(url) => setPreviewImage(url)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 pt-12">
            <h1 className="text-xl font-bold">你好，我是 PrepMind 👋</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              你的 AI 备考助手，随时为你解答
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <QuickTag label="📷 拍照识题" onSelect={() => handleQuickSend("请帮我讲解拍照识题功能怎么用")} />
              <QuickTag label="📝 错题复习" onSelect={() => handleQuickSend("帮我制定一个错题复习计划")} />
              <QuickTag label="📊 学习计划" onSelect={() => handleQuickSend("帮我制定今天的学习计划")} />
              <QuickTag label="💡 知识讲解" onSelect={() => handleQuickSend("用简单的方式讲解一下深度学习的基本概念")} />
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

      {/* 图片全屏预览 */}
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
// memo 优化性能，避免重复渲染 ChatBubble 组件时触发的 useEffect
const ChatBubble = memo(function ChatBubble({
  role,
  content,
  username,
  isLoading,
}: {
  role: "user" | "assistant";
  content: string;
  username: string;
  isLoading?: boolean;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? username[0]?.toUpperCase() : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : "bg-muted text-foreground rounded-tl-md"
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

function OcrBubble({
  type,
  content,
  imageUrl,
  username,
  onImageClick,
}: {
  type: "user" | "ocr-loading" | "ocr-result";
  content: string;
  imageUrl?: string;
  username: string;
  onImageClick?: (url: string) => void;
}) {
  if (type === "user") {
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

  if (type === "ocr-loading") {
    return (
      <div className="flex gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">正在识别题目...</span>
          </div>
        </div>
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
        <div className="markdown-body">
          <Markdown remarkPlugins={remarkPlugins}>{content}</Markdown>
        </div>
        <button
          type="button"
          onClick={() => alert("错题本功能即将上线，敬请期待！")}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.98]"
        >
          📝 保存到错题本
        </button>
      </div>
    </div>
  );
}
