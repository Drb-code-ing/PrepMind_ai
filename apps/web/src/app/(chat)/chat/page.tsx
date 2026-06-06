"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import ChatTopBar from "@/components/chat/chat-top-bar";
import ChatSidebar from "@/components/chat/chat-sidebar";
import ChatInputBar from "@/components/chat/chat-input-bar";
import { useUserStore } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { Bot, Loader2 } from "lucide-react";

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentUser = useUserStore((s) => s.currentUser);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { inputDraft, setInputDraft } = useChatStore();

  const {
    messages,
    handleInputChange,
    handleSubmit,
    input,
    setInput,
    isLoading,
  } = useChat({
    api: "/api/chat",
    initialInput: inputDraft,
  });

  // 同步 useChat 的 input 到 chatStore（切页面不丢失）
  useEffect(() => {
    if (input !== inputDraft) {
      setInputDraft(input);
    }
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  // 新消息自动滚到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleQuickSend = useCallback(
    (text: string) => {
      setInput(text);
      setTimeout(() => {
        const form = document.querySelector<HTMLFormElement>("[data-chat-form]");
        form?.requestSubmit();
      }, 0);
    },
    [setInput],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <ChatTopBar onMenuClick={() => setSidebarOpen(true)} />

      <main ref={scrollRef} className="flex-1 overflow-y-auto hide-scrollbar">
        {hasMessages ? (
          <div className="flex flex-col gap-3 px-4 py-4">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role as "user" | "assistant"}
                content={msg.content}
                username={currentUser?.username || "我"}
                isLoading={
                  isLoading &&
                  msg.id === messages[messages.length - 1]?.id &&
                  msg.role === "assistant"
                }
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <ChatBubble role="assistant" content="" username="" isLoading />
            )}
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

      <form data-chat-form onSubmit={handleSubmit}>
        <ChatInputBar input={input} onInputChange={handleInputChange} />
      </form>

      <ChatSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

function ChatBubble({
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
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : "bg-muted text-foreground rounded-tl-md"
        }`}
      >
        {isLoading && !content ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            {content}
            {isLoading && content && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
