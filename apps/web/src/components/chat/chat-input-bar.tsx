"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, Plus, Mic, Send, Image, FileText, X } from "lucide-react";

export interface SelectedImage {
  file: File;
  previewUrl: string;
}

interface ChatInputBarProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  selectedImage?: SelectedImage | null;
  onImageSelect?: (image: SelectedImage) => void;
  onImageRemove?: () => void;
}

export default function ChatInputBar({
  input,
  onInputChange,
  selectedImage,
  onImageSelect,
  onImageRemove,
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImageSelect) return;
      const reader = new FileReader();
      reader.onload = () => {
        onImageSelect({ file, previewUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
      setMenuOpen(false);
      e.target.value = "";
    },
    [onImageSelect],
  );

  return (
    <div className="shrink-0 bg-white">
      <div className="h-px bg-border" />

      {/* 已选图片预览 */}
      {selectedImage && (
        <div className="px-3 pt-2">
          <div className="relative inline-block">
            <img
              src={selectedImage.previewUrl}
              alt="已选图片"
              className="h-20 w-20 rounded-xl object-cover ring-1 ring-border"
            />
            <button
              type="button"
              onClick={onImageRemove}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/70 text-white transition-colors hover:bg-foreground"
              aria-label="移除图片"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

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

      {/* 隐藏的文件输入 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 功能菜单 */}
      {menuOpen && (
        <div className="flex items-center gap-4 px-5 py-3">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex flex-col items-center gap-1"
          >
            <div className="tap-target flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95">
              <Image className="h-5 w-5" />
            </div>
            <span className="text-[11px] text-muted-foreground">图片</span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex flex-col items-center gap-1"
          >
            <div className="tap-target flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-[11px] text-muted-foreground">文件</span>
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-1"
          >
            <div className="tap-target flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95">
              <Camera className="h-5 w-5" />
            </div>
            <span className="text-[11px] text-muted-foreground">拍照</span>
          </button>
        </div>
      )}

      {/* 功能按钮行 */}
      <div className="flex items-center justify-between px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMenu}
            className={`tap-target flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-muted active:scale-95 ${
              menuOpen ? "bg-muted text-foreground" : "text-muted-foreground"
            }`}
            aria-label={menuOpen ? "收起菜单" : "更多功能"}
          >
            <span className={`transition-transform duration-200 ${menuOpen ? "rotate-45" : ""}`}>
              <Plus className="h-5 w-5" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-95"
            aria-label="拍照识题"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        {input.trim() || selectedImage ? (
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
