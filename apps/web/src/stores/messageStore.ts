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
