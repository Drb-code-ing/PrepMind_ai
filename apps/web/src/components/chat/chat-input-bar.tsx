'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, FileText, Image as ImageIcon, Mic, Plus, Send, Square, X } from 'lucide-react';

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
  isGenerating?: boolean;
  onStop?: () => void;
}

export default function ChatInputBar({
  input,
  onInputChange,
  selectedImage,
  onImageSelect,
  onImageRemove,
  isGenerating = false,
  onStop,
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  const toggleMenu = useCallback(() => {
    if (isGenerating) return;
    setMenuOpen((value) => !value);
  }, [isGenerating]);

  const isMenuVisible = menuOpen && !isGenerating;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isGenerating) return;
      const file = e.target.files?.[0];
      if (!file || !onImageSelect) return;

      const reader = new FileReader();
      reader.onload = () => {
        onImageSelect({ file, previewUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
      setMenuOpen(false);
      e.target.value = '';
    },
    [isGenerating, onImageSelect],
  );

  return (
    <div className="shrink-0 border-t border-[var(--pm-line)] bg-white/82 backdrop-blur-xl">
      {selectedImage ? (
        <div className="px-3 pt-2">
          <div className="relative inline-block">
            <Image
              src={selectedImage.previewUrl}
              alt="已选择的图片"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-2xl object-cover ring-1 ring-[var(--pm-line)]"
            />
            <button
              type="button"
              onClick={onImageRemove}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#2b2335] text-white shadow-sm transition-all hover:bg-[#3a3047] active:scale-95"
              aria-label="移除图片"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="px-3 pt-3">
        <div className="rounded-[1.4rem] border border-[var(--pm-line)] bg-white/85 px-4 py-2.5 shadow-sm transition-all focus-within:border-[#ff8fc7] focus-within:ring-4 focus-within:ring-pink-100">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onInput={handleInput}
            placeholder={isGenerating ? 'AI 正在回复，可以点击右侧停止' : '发消息，或拍照识题'}
            rows={1}
            className="w-full resize-none bg-transparent text-sm leading-6 text-[var(--pm-ink)] outline-none placeholder:text-[var(--pm-muted)]"
            style={{ maxHeight: '120px' }}
          />
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={isGenerating}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isGenerating}
      />

      {isMenuVisible ? (
        <div className="mx-3 mt-3 grid grid-cols-3 gap-2 rounded-[1.25rem] bg-white/88 p-2 ring-1 ring-[var(--pm-line)]">
          <ToolButton
            label="图片"
            icon={<ImageIcon className="h-5 w-5" />}
            onClick={() => galleryInputRef.current?.click()}
          />
          <ToolButton
            label="文件"
            icon={<FileText className="h-5 w-5" />}
            onClick={() => setMenuOpen(false)}
          />
          <ToolButton
            label="拍照"
            icon={<Camera className="h-5 w-5" />}
            onClick={() => cameraInputRef.current?.click()}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMenu}
            disabled={isGenerating}
            className={`tap-target flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-all active:scale-95 ${
              isMenuVisible
                ? 'bg-[#fff1f8] text-[#d94b91] ring-pink-100'
                : 'bg-white/75 text-[var(--pm-muted)] ring-[var(--pm-line)] hover:bg-white'
            } disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100`}
            aria-label={isMenuVisible ? '收起菜单' : '更多功能'}
          >
            <span className={`transition-transform duration-200 ${isMenuVisible ? 'rotate-45' : ''}`}>
              <Plus className="h-5 w-5" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isGenerating}
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#f8fbff] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            aria-label="拍照识题"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-[#2b2335] text-white shadow-sm transition-all hover:bg-[#3a3047] active:scale-90"
            aria-label="停止生成"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : input.trim() || selectedImage ? (
          <button
            type="submit"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-[#ff8fc7] text-white shadow-sm transition-all hover:bg-[#e9579f] active:scale-90"
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-95"
            aria-label="语音输入"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1">
      <div className="tap-target flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1f8] text-[#d94b91] transition-all hover:bg-pink-100 active:scale-95">
        {icon}
      </div>
      <span className="text-[11px] font-medium text-[var(--pm-muted)]">{label}</span>
    </button>
  );
}
