"use client";

import { useState } from "react";
import ChatTopBar from "@/components/chat/chat-top-bar";
import ChatSidebar from "@/components/chat/chat-sidebar";
import ChatInputBar from "@/components/chat/chat-input-bar";

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* 顶部导航栏 */}
      <ChatTopBar onMenuClick={() => setSidebarOpen(true)} />

      {/* 聊天主区域 */}
      <main className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="flex flex-col items-center px-4 pt-12">
          {/* 欢迎文字 */}
          <h1 className="text-xl font-bold">你好，我是 PrepMind 👋</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            你的 AI 备考助手，随时为你解答
          </p>

          {/* 快捷入口 */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <QuickTag label="📷 拍照识题" />
            <QuickTag label="📝 错题复习" />
            <QuickTag label="📊 学习计划" />
            <QuickTag label="💡 知识讲解" />
          </div>
        </div>
      </main>

      {/* 底部输入栏 */}
      <ChatInputBar />

      {/* 侧边栏 */}
      <ChatSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

function QuickTag({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-full border border-border bg-muted/50 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted active:scale-95"
    >
      {label}
    </button>
  );
}
