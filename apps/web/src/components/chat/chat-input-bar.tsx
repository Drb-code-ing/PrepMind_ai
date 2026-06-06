"use client";

import { useRef } from "react";
import { Camera, Plus, Mic, Send } from "lucide-react";

interface ChatInputBarProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export default function ChatInputBar({ input, onInputChange }: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div className="shrink-0 bg-white">
      <div className="h-px bg-border" />

      {/* 文本输入区 */}
      <div className="px-3 pt-3">
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-2.5 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onInput={handleInput}
            placeholder="发消息..."
            rows={1}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            style={{ maxHeight: "120px" }}
          />
        </div>
      </div>

      {/* 功能按钮行 */}
      <div className="flex items-center justify-between px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-95"
            aria-label="更多功能"
          >
            <Plus className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-95"
            aria-label="拍照识题"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        {input.trim() ? (
          <button
            type="submit"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-90"
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-95"
            aria-label="按住说话"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
