import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatState {
  /** 输入框内容（切页面不丢失） */
  inputDraft: string;
  setInputDraft: (text: string) => void;
  clearInputDraft: () => void;
  /** 清空所有临时状态 */
  resetChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(// persist 用于持久化存储 inputDraft
    (set) => ({
      inputDraft: "",
      setInputDraft: (text) => set({ inputDraft: text }),
      clearInputDraft: () => set({ inputDraft: "" }),
      resetChat: () => set({ inputDraft: "" }),
    }),
    {
      name: "prepmind-chat",
      partialize: (state) => ({ inputDraft: state.inputDraft }),
    },
  ),
);
