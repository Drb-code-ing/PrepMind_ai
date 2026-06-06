"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Image, FileText, Plus, Mic, Send } from "lucide-react";

interface ChatInputBarProps {
  onSend: (content: string) => void;
}

export default function ChatInputBar({ onSend }: ChatInputBarProps) {
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整输入框高度
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [input]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    setShowMenu(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shrink-0 bg-white">
      {/* 顶部分割线 */}
      <div className="h-px bg-border" />

      {/* 展开菜单（加号点击后） */}
      {showMenu && (
        <div className="flex items-center gap-5 border-b border-border px-5 py-4">
          <ExpandMenuItem icon={Camera} label="拍照" />
          <ExpandMenuItem icon={Image} label="相册" />
          <ExpandMenuItem icon={FileText} label="文件" />
        </div>
      )}

      {/* 文本输入区 */}
      <div className="px-3 pt-3">
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-2.5 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="发消息..."
            rows={1}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            style={{ maxHeight: "120px" }}
          />
        </div>
      </div>

      {/* 功能按钮行 */}
      <div className="flex items-center justify-between px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {/* 左侧按钮组 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className={`tap-target flex h-9 w-9 items-center justify-center rounded-full transition-all ${
              showMenu
                ? "bg-primary/10 text-primary rotate-45"
                : "text-muted-foreground hover:bg-muted active:scale-95"
            }`}
            aria-label="更多功能"
          >
            <Plus className="h-5 w-5 transition-transform duration-200" />
          </button>

          <button
            type="button"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-95"
            aria-label="拍照识题"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        {/* 右侧按钮 */}
        {input.trim() ? (
          <button
            type="button"
            onClick={handleSend}
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

function ExpandMenuItem({
  icon: Icon,
  label,
}: {
  icon: typeof Camera;
  label: string;
}) {
  return (
    <button type="button" className="flex flex-col items-center gap-2 tap-target active:scale-95">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted transition-colors hover:bg-muted/80">
        <Icon className="h-6 w-6 text-foreground" />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
