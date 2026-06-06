"use client";

import { useState, useRef, useEffect } from "react";
import ChatTopBar from "@/components/chat/chat-top-bar";
import ChatSidebar from "@/components/chat/chat-sidebar";
import ChatInputBar from "@/components/chat/chat-input-bar";
import { useUserStore } from "@/stores/userStore";
import { Bot } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const currentUser = useUserStore((s) => s.currentUser);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新消息自动滚到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend(content: string) {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // TODO: Phase 3 接入 AI 回复，目前用 mock 回复
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `收到你的消息："${content}"。AI 讲解功能将在后续版本上线，敬请期待！`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 800);
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* 顶部导航栏 */}
      <ChatTopBar onMenuClick={() => setSidebarOpen(true)} />

      {/* 聊天主区域 */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto hide-scrollbar">
        {hasMessages ? (
          /* 消息列表 */
          <div className="flex flex-col gap-3 px-4 py-4">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                username={currentUser?.username || "我"}
              />
            ))}
          </div>
        ) : (
          /* 欢迎页 */
          <div className="flex flex-col items-center px-4 pt-12">
            <h1 className="text-xl font-bold">你好，我是 PrepMind 👋</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              你的 AI 备考助手，随时为你解答
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <QuickTag label="📷 拍照识题" onSelect={() => handleSend("拍照识题")} />
              <QuickTag label="📝 错题复习" onSelect={() => handleSend("错题复习")} />
              <QuickTag label="📊 学习计划" onSelect={() => handleSend("学习计划")} />
              <QuickTag label="💡 知识讲解" onSelect={() => handleSend("知识讲解")} />
            </div>
          </div>
        )}
      </main>

      {/* 底部输入栏 */}
      <ChatInputBar onSend={handleSend} />

      {/* 侧边栏 */}
      <ChatSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

function ChatBubble({
  message,
  username,
}: {
  message: ChatMessage;
  username: string;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* 头像 */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? username[0]?.toUpperCase() : <Bot className="h-4 w-4" />}
      </div>

      {/* 气泡 */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : "bg-muted text-foreground rounded-tl-md"
        }`}
      >
        {message.content}
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
