"use client";

import { Menu } from "lucide-react";

interface ChatTopBarProps {
  onMenuClick: () => void;
}

export default function ChatTopBar({ onMenuClick }: ChatTopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-white px-4 py-3">
      {/* 左侧占位 */}
      <div className="w-10" />

      {/* 中间标题 */}
      <div className="flex flex-col items-center">
        <h1 className="text-base font-semibold">PrepMind</h1>
        <span className="text-[11px] text-muted-foreground">AI 备考助手</span>
      </div>

      {/* 右侧菜单按钮 */}
      <button
        type="button"
        onClick={onMenuClick}
        className="tap-target flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}
