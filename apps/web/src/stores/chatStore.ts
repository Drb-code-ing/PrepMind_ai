import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatState {
  /** 输入框内容（切页面不丢失） */
  inputDraft: string;
  setInputDraft: (text: string) => void;

  /** 当前会话 ID（后续对接后端用） */
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;

  /** 是否正在等待 AI 回复 */
  isWaiting: boolean;
  setIsWaiting: (v: boolean) => void;

  /** 清空所有临时状态 */
  resetChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      inputDraft: "",
      setInputDraft: (text) => set({ inputDraft: text }),

      currentSessionId: null,
      setCurrentSessionId: (id) => set({ currentSessionId: id }),

      isWaiting: false,
      setIsWaiting: (v) => set({ isWaiting: v }),

      resetChat: () =>
        set({
          inputDraft: "",
          currentSessionId: null,
          isWaiting: false,
        }),
    }),
    {
      name: "prepmind-chat",
      // 只持久化 inputDraft，其他字段是临时态
      partialize: (state) => ({ inputDraft: state.inputDraft }),
    },
  ),
);
