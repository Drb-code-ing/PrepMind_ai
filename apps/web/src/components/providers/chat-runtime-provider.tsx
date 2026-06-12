'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useChat } from '@ai-sdk/react';

import { useChatMessages, useSyncChatMessages } from '@/hooks/use-chat-messages';
import { ApiClientError } from '@/lib/api-client';
import type { ActiveStudyContext } from '@/lib/chat-context';
import { db, type StoredMessage } from '@/lib/db';
import { useChatStore } from '@/stores/chatStore';
import { useUserStore } from '@/stores/userStore';

const STREAM_UI_THROTTLE_MS = 80;

type RuntimeMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatRuntimeContextValue = {
  messages: RuntimeMessage[];
  input: string;
  setInput: (value: string) => void;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: ReturnType<typeof useChat>['handleSubmit'];
  isLoading: boolean;
  stop: () => void;
  chatError: string | null;
  setChatError: Dispatch<SetStateAction<string | null>>;
  chatTimestamps: Record<string, number>;
  activeStudyContext: ActiveStudyContext | null;
  setActiveStudyContext: Dispatch<SetStateAction<ActiveStudyContext | null>>;
  isHydrated: boolean;
};

const ChatRuntimeContext = createContext<ChatRuntimeContextValue | null>(null);

function getReadableChatError(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // The AI SDK may pass plain text messages for stream errors.
  }

  return error.message || 'AI 服务暂时不可用，请稍后重试';
}

function logBackgroundSyncError(scope: string, error: unknown) {
  if (error instanceof ApiClientError) {
    console.warn(`${scope}: ${error.code} (${error.status}) ${error.message}`);
    return;
  }

  console.warn(`${scope}: ${error instanceof Error ? error.message : 'unknown error'}`);
}

function toRuntimeMessages(messages: StoredMessage[]): RuntimeMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }));
}

function toTimestampMap(messages: StoredMessage[]) {
  return Object.fromEntries(messages.map((message) => [message.id, message.createdAt]));
}

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const currentUser = useUserStore((state) => state.currentUser);
  const userId = currentUser?.id ?? null;
  const { inputDraft, setInputDraft, clearInputDraft } = useChatStore();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatTimestamps, setChatTimestamps] = useState<Record<string, number>>({});
  const [activeStudyContext, setActiveStudyContext] = useState<ActiveStudyContext | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const serverMessagesHydratedRef = useRef(false);
  const suppressNextServerSyncRef = useRef(false);
  const messagesSavedRef = useRef(false);
  const inputDraftClearReadyRef = useRef(false);
  const prevMsgIdsRef = useRef<Set<string>>(new Set());
  const chatTimestampsRef = useRef(chatTimestamps);
  const activeStudyContextRef = useRef(activeStudyContext);

  const {
    messages,
    setMessages,
    handleInputChange: baseHandleInputChange,
    handleSubmit,
    input,
    setInput: setChatInput,
    isLoading,
    stop,
  } = useChat({
    api: '/api/chat',
    experimental_throttle: STREAM_UI_THROTTLE_MS,
    initialInput: inputDraft,
    initialMessages: [],
    experimental_prepareRequestBody: ({ messages: requestMessages, requestBody }) => ({
      ...requestBody,
      messages: requestMessages,
      activeContext: activeStudyContextRef.current,
    }),
    keepLastMessageOnError: true,
    onError: (error) => {
      setChatError(getReadableChatError(error));
    },
  });

  const messagesRef = useRef(messages);
  useLayoutEffect(() => {
    messagesRef.current = messages;
    chatTimestampsRef.current = chatTimestamps;
    activeStudyContextRef.current = activeStudyContext;
  });

  const chatMessagesQuery = useChatMessages(conversationId ? { conversationId } : {});
  const syncChatMessages = useSyncChatMessages();

  const toStoredMessages = useCallback(
    (runtimeMessages: RuntimeMessage[]): StoredMessage[] => {
      const ts = chatTimestampsRef.current;
      return runtimeMessages.map((message, index) => ({
        id: message.id,
        userId: userId ?? '',
        role: message.role,
        content: message.content,
        order: index,
        createdAt: ts[message.id] ?? Date.now(),
      }));
    },
    [userId],
  );

  const saveChatToDb = useCallback(
    async (storedMessages: StoredMessage[]) => {
      if (!userId) return;

      await db.transaction('rw', db.messages, async () => {
        await db.messages.where('userId').equals(userId).delete();
        if (storedMessages.length > 0) {
          await db.messages.bulkAdd(storedMessages);
        }
      });
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      serverMessagesHydratedRef.current = false;
      suppressNextServerSyncRef.current = false;
      messagesSavedRef.current = false;
      inputDraftClearReadyRef.current = false;
      prevMsgIdsRef.current = new Set();
      queueMicrotask(() => {
        setMessages([]);
        setChatTimestamps({});
        setConversationId(null);
        setActiveStudyContext(null);
        setIsHydrated(false);
      });
      return;
    }

    let cancelled = false;
    serverMessagesHydratedRef.current = false;
    suppressNextServerSyncRef.current = false;
    messagesSavedRef.current = false;
    inputDraftClearReadyRef.current = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsHydrated(false);
      setConversationId(null);
      setActiveStudyContext(null);
    });

    db.messages
      .where('userId')
      .equals(userId)
      .sortBy('order')
      .then((localMessages) => {
        if (cancelled) return;

        setMessages(toRuntimeMessages(localMessages));
        setChatTimestamps(toTimestampMap(localMessages));
        prevMsgIdsRef.current = new Set(localMessages.map((message) => message.id));
        setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [setMessages, userId]);

  useEffect(() => {
    const serverData = chatMessagesQuery.data;
    if (!userId || !isHydrated || !serverData || serverMessagesHydratedRef.current) return;

    serverMessagesHydratedRef.current = true;

    queueMicrotask(() => {
      if (serverData.conversationId) {
        setConversationId(serverData.conversationId);
      }

      if (serverData.messages.length > 0) {
        const serverRuntimeMessages = toRuntimeMessages(serverData.messages);
        suppressNextServerSyncRef.current = true;
        setChatTimestamps(toTimestampMap(serverData.messages));
        prevMsgIdsRef.current = new Set(serverData.messages.map((message) => message.id));
        setMessages(serverRuntimeMessages);
        void saveChatToDb(serverData.messages);
        return;
      }

      const localMessages = toStoredMessages(messagesRef.current as RuntimeMessage[]);
      if (localMessages.length === 0) return;

      syncChatMessages
        .mutateAsync({ messages: localMessages, conversationId: serverData.conversationId })
        .then((result) => {
          if (result.conversationId) {
            setConversationId(result.conversationId);
          }
        })
        .catch((error) => {
          logBackgroundSyncError('[ChatMessages initial sync]', error);
        });
    });
  }, [
    chatMessagesQuery.data,
    isHydrated,
    saveChatToDb,
    setMessages,
    syncChatMessages,
    toStoredMessages,
    userId,
  ]);

  useEffect(() => {
    const currentIds = new Set(messages.map((message) => message.id));
    let changed = false;
    const nextTimestamps = { ...chatTimestampsRef.current };

    for (const message of messages) {
      if (!prevMsgIdsRef.current.has(message.id)) {
        nextTimestamps[message.id] = Date.now();
        changed = true;
      }
    }

    prevMsgIdsRef.current = currentIds;
    if (changed) {
      setChatTimestamps(nextTimestamps);
    }
  }, [messages]);

  useEffect(() => {
    if (!userId || !isHydrated) return;

    if (!messagesSavedRef.current) {
      messagesSavedRef.current = true;
      return;
    }

    const storedMessages = toStoredMessages(messages as RuntimeMessage[]);
    if (storedMessages.length === 0) return;

    void saveChatToDb(storedMessages);

    if (suppressNextServerSyncRef.current) {
      suppressNextServerSyncRef.current = false;
      return;
    }

    if (!isLoading) {
      syncChatMessages
        .mutateAsync({ messages: storedMessages, conversationId })
        .then((result) => {
          if (result.conversationId) {
            setConversationId(result.conversationId);
          }
        })
        .catch((error) => {
          logBackgroundSyncError('[ChatMessages sync]', error);
        });
    }
  }, [
    conversationId,
    isHydrated,
    isLoading,
    messages,
    saveChatToDb,
    syncChatMessages,
    toStoredMessages,
    userId,
  ]);

  useEffect(() => {
    const flush = () => {
      if (!userId) return;
      const storedMessages = toStoredMessages(messagesRef.current as RuntimeMessage[]);
      if (storedMessages.length === 0) return;

      void db.transaction('rw', db.messages, async () => {
        await db.messages.where('userId').equals(userId).delete();
        await db.messages.bulkAdd(storedMessages);
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [toStoredMessages, userId]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!inputDraftClearReadyRef.current) {
      inputDraftClearReadyRef.current = true;
      return;
    }

    if (messages.length > 0) {
      clearInputDraft();
    }
  }, [clearInputDraft, isHydrated, messages.length]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      baseHandleInputChange(event);
      setInputDraft(event.target.value);
    },
    [baseHandleInputChange, setInputDraft],
  );

  const setInput = useCallback(
    (value: string) => {
      setChatInput(value);
      setInputDraft(value);
    },
    [setChatInput, setInputDraft],
  );

  const value = useMemo<ChatRuntimeContextValue>(
    () => ({
      messages: messages as RuntimeMessage[],
      input,
      setInput,
      handleInputChange,
      handleSubmit,
      isLoading,
      stop,
      chatError,
      setChatError,
      chatTimestamps,
      activeStudyContext,
      setActiveStudyContext,
      isHydrated,
    }),
    [
      activeStudyContext,
      chatError,
      chatTimestamps,
      handleInputChange,
      handleSubmit,
      input,
      isHydrated,
      isLoading,
      messages,
      setInput,
      stop,
    ],
  );

  return <ChatRuntimeContext.Provider value={value}>{children}</ChatRuntimeContext.Provider>;
}

export function useChatRuntime() {
  const value = useContext(ChatRuntimeContext);
  if (!value) {
    throw new Error('useChatRuntime must be used within ChatRuntimeProvider');
  }
  return value;
}
