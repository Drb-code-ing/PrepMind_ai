'use client';

import { Menu, Sparkles } from 'lucide-react';

interface ChatTopBarProps {
  onMenuClick: () => void;
}

export default function ChatTopBar({ onMenuClick }: ChatTopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pm-line)] bg-white/72 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1f8] text-[#d94b91] ring-1 ring-pink-100">
          <Sparkles className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-base font-semibold text-[var(--pm-ink)]">PrepMind AI</h1>
          <span className="text-[11px] font-medium text-[var(--pm-muted)]">
            正在陪你备考
          </span>
        </div>

        <button
          type="button"
          onClick={onMenuClick}
          className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-pink-50 active:scale-95"
          aria-label="打开导航"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
