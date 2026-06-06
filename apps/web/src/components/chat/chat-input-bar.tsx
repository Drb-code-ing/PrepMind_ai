"use client";

import { useState, useRef } from "react";
import { Camera, Plus, Mic, Send } from "lucide-react";

export default function ChatInputBar() {
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    if (!input.trim()) return;
    // TODO: 发送消息逻辑
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
    <div className="sticky bottom-0 z-30 border-t border-border bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* 展开菜单（加号点击后） */}
      {showMenu && (
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <MenuButton icon={Camera} label="拍照" />
          <MenuButton icon={Camera} label="相册" />
          <MenuButton icon={Camera} label="文件" />
        </div>
      )}

      {/* 输入区域 */}
      <div className="flex items-end gap-2 px-3 py-2">
        {/* 左侧：加号 */}
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className={`tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
            showMenu
              ? "bg-primary text-white rotate-45"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          aria-label="更多功能"
        >
          <Plus className="h-5 w-5 transition-transform duration-200" />
        </button>

        {/* 中间：输入框 */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="发消息..."
            rows={1}
            className="tap-target w-full resize-none rounded-2xl border border-border bg-muted/50 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            style={{ maxHeight: "120px" }}
          />
          {/* 左侧相机图标（输入框内部） */}
          <button
            type="button"
            className="absolute left-2 bottom-1.5 tap-target flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            aria-label="拍照识题"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        {/* 右侧：发送 / 按住说话 */}
        {input.trim() ? (
          <button
            type="button"
            onClick={handleSend}
            className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all hover:bg-primary-dark active:scale-90"
            aria-label="发送"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all hover:bg-muted/80 active:scale-90"
            aria-label="按住说话"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
}: {
  icon: typeof Camera;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1.5 tap-target"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted transition-colors hover:bg-muted/80 active:scale-95">
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
