// 消息存储状态管理
// 用于持久化聊天消息，避免页面刷新后丢失消息(本地存储,后续可使用数据库存储)

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageState {
  messages: StoredMessage[];
  setMessages: (messages: StoredMessage[]) => void;
  clearMessages: () => void;
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set) => ({
      messages: [],
      setMessages: (messages) => set({ messages }),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "prepmind-messages",
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
