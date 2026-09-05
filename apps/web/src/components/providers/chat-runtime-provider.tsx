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
import type { JSONValue } from 'ai';

import { useChatMessages, useSyncChatMessages } from '@/hooks/use-chat-messages';
import { ApiClientError } from '@/lib/api-client';
import {
  buildChatCompletionSignature,
  CHAT_EMPTY_ASSISTANT_MESSAGE,
  getChatCompletionGuard,
  getChatSyncSettleMs,
  selectHydratedChatHistory,
  shouldPersistChatSnapshot,
} from '@/lib/chat-completion-guard';
import type { ActiveStudyContext } from '@/lib/chat-context';
import { createChatRuntimeRequestBodyPreparer } from '@/lib/chat-runtime-request';
import { beginChatServerSync, buildChatSyncSignature } from '@/lib/chat-sync';
import {
  createChatTurnRecoveryCache,
  createChatTurnRecoveryRecord,
} from '@/lib/chat-turn-recovery-cache';
import {
  ChatTurnRecoveryHistoryError,
  removeChatTurnRecoveryMessage,
  resolveChatTurnRecoveryMessage,
  upsertChatTurnRecoveryMessage,
} from '@/lib/chat-turn-recovery-messages';
import {
  getLatestChatTurnHandoff,
  hasPendingChatTurnHandoff,
  omitChatTurnHandoffMessages,
} from '@/lib/chat-turn-handoff';
import { chatTurnReplayApi } from '@/lib/chat-turn-replay-api';
import {
  ChatTurnReplayError,
  followChatTurn,
  type ChatTurnReplayProgress,
} from '@/lib/chat-turn-replay';
import {
  createConversationStateCache,
  createConversationStateRuntimeBridge,
  shouldApplyConversationStateRestore,
} from '@/lib/conversation-state-cache';
import { db, type StoredChatTurnRecovery, type StoredMessage } from '@/lib/db';
import { useChatStore } from '@/stores/chatStore';
import { useUserStore } from '@/stores/userStore';

const STREAM_UI_THROTTLE_MS = 80;
const conversationStateRuntimeBridge = createConversationStateRuntimeBridge(
  createConversationStateCache(db.conversationStates),
);
const chatTurnRecoveryCache = createChatTurnRecoveryCache(db.chatTurnRecoveries);

type RuntimeMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  annotations?: JSONValue[];
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
  const accessToken = useUserStore((state) => state.accessToken);
  const userId = currentUser?.id ?? null;
  const { inputDraft, setInputDraft, clearInputDraft } = useChatStore();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatTimestamps, setChatTimestamps] = useState<Record<string, number>>({});
  const [activeStudyContext, setActiveStudyContext] = useState<ActiveStudyContext | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [chatTurnRecovery, setChatTurnRecovery] = useState<StoredChatTurnRecovery | null>(null);

  const serverMessagesHydratedRef = useRef(false);
  const messagesSavedRef = useRef(false);
  const inputDraftClearReadyRef = useRef(false);
  const lastServerSyncKeyRef = useRef('');
  const inFlightServerSyncKeyRef = useRef('');
  const lastEmptyAssistantUserMessageIdRef = useRef('');
  const streamStartedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const prevMsgIdsRef = useRef<Set<string>>(new Set());
  const chatTimestampsRef = useRef(chatTimestamps);
  const conversationIdRef = useRef(conversationId);
  const userIdRef = useRef(userId);
  const activeStudyContextRef = useRef(activeStudyContext);
  const accessTokenRef = useRef(accessToken);
  const chatTurnRecoveryRef = useRef(chatTurnRecovery);

  const {
    messages,
    setMessages,
    handleInputChange: baseHandleInputChange,
    handleSubmit: baseHandleSubmit,
    input,
    setInput: setChatInput,
    isLoading,
    stop,
  } = useChat({
    api: '/api/chat',
    experimental_throttle: STREAM_UI_THROTTLE_MS,
    initialInput: inputDraft,
    initialMessages: [],
    experimental_prepareRequestBody: (input) =>
      createChatRuntimeRequestBodyPreparer({
        getActiveContext: () => activeStudyContextRef.current,
        getAccessToken: () => accessTokenRef.current,
        getConversationId: () => conversationIdRef.current,
      })(input),
    keepLastMessageOnError: true,
    onError: (error) => {
      setChatError(getReadableChatError(error));
    },
  });

  const messagesRef = useRef<RuntimeMessage[]>(messages as RuntimeMessage[]);
  useLayoutEffect(() => {
    messagesRef.current = messages as RuntimeMessage[];
    chatTimestampsRef.current = chatTimestamps;
    conversationIdRef.current = conversationId;
    userIdRef.current = userId;
    activeStudyContextRef.current = activeStudyContext;
    accessTokenRef.current = accessToken;
    chatTurnRecoveryRef.current = chatTurnRecovery;
    isLoadingRef.current = isLoading;
  });

  const messageSyncSignature = useMemo(
    () => buildChatCompletionSignature(messages as RuntimeMessage[]),
    [messages],
  );
  const chatTurnHandoffSignature = useMemo(() => {
    const latest = getLatestChatTurnHandoff(messages as RuntimeMessage[]);
    return latest ? `${latest.message.id}\u0000${latest.handoff.turnId}` : '';
  }, [messages]);

  const chatMessagesQuery = useChatMessages(conversationId ? { conversationId } : {});
  const syncChatMessages = useSyncChatMessages();
  const syncChatMessagesMutateAsyncRef = useRef(syncChatMessages.mutateAsync);

  useLayoutEffect(() => {
    syncChatMessagesMutateAsyncRef.current = syncChatMessages.mutateAsync;
  });

  const toStoredMessages = useCallback(
    (runtimeMessages: RuntimeMessage[]): StoredMessage[] => {
      const ts = chatTimestampsRef.current;
      return omitChatTurnHandoffMessages(runtimeMessages).map((message, index) => ({
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

  const selectStoredMessagesForHydration = useCallback(
    (storedMessages: StoredMessage[], preserveIncompleteTail: boolean) => {
      const runtimeMessages = selectHydratedChatHistory(toRuntimeMessages(storedMessages), {
        preserveIncompleteTail,
      });
      const validMessageIds = new Set(runtimeMessages.map((message) => message.id));
      return storedMessages.filter((message) => validMessageIds.has(message.id));
    },
    [],
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

  const syncStoredMessagesToServer = useCallback(
    async (
      storedMessages: StoredMessage[],
      targetConversationId: string | null | undefined,
      scope: string,
    ) => {
      if (storedMessages.length === 0) return;

      const syncKey = buildChatSyncSignature(storedMessages, targetConversationId);
      const syncDecision = beginChatServerSync({
        syncKey,
        lastServerSyncKey: lastServerSyncKeyRef.current,
        inFlightServerSyncKey: inFlightServerSyncKeyRef.current,
      });
      if (!syncDecision.shouldSync) return;

      inFlightServerSyncKeyRef.current = syncDecision.nextInFlightServerSyncKey;

      try {
        const result = await syncChatMessagesMutateAsyncRef.current({
          messages: storedMessages,
          conversationId: targetConversationId,
        });
        const acknowledgedConversationId = result.conversationId ?? targetConversationId ?? null;
        lastServerSyncKeyRef.current = buildChatSyncSignature(
          storedMessages,
          acknowledgedConversationId,
        );

        if (result.conversationId) {
          setConversationId(result.conversationId);
        }
        if (userId) {
          await conversationStateRuntimeBridge.acceptServerResult(userId, result);
        }
      } catch (error) {
        logBackgroundSyncError(scope, error);
      } finally {
        if (inFlightServerSyncKeyRef.current === syncKey) {
          inFlightServerSyncKeyRef.current = '';
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    let cancelled = false;
    const expectedUserId = userId;
    const conversationStateRestore = conversationStateRuntimeBridge
      .changeIdentity(userId)
      .catch(() => null);
    if (!userId) {
      void conversationStateRestore;
      serverMessagesHydratedRef.current = false;
      messagesSavedRef.current = false;
      inputDraftClearReadyRef.current = false;
      lastServerSyncKeyRef.current = '';
      inFlightServerSyncKeyRef.current = '';
      lastEmptyAssistantUserMessageIdRef.current = '';
      streamStartedRef.current = false;
      prevMsgIdsRef.current = new Set();
      queueMicrotask(() => {
        if (cancelled) return;
        setMessages([]);
        setChatTimestamps({});
        setConversationId(null);
        setActiveStudyContext(null);
        chatTurnRecoveryRef.current = null;
        setChatTurnRecovery(null);
        setIsHydrated(false);
      });
      return () => {
        cancelled = true;
      };
    }

    serverMessagesHydratedRef.current = false;
    messagesSavedRef.current = false;
    inputDraftClearReadyRef.current = false;
    lastServerSyncKeyRef.current = '';
    inFlightServerSyncKeyRef.current = '';
    lastEmptyAssistantUserMessageIdRef.current = '';
    streamStartedRef.current = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsHydrated(false);
      setConversationId(null);
      setActiveStudyContext(null);
      chatTurnRecoveryRef.current = null;
      setChatTurnRecovery(null);
    });

    void Promise.all([
      conversationStateRestore,
      db.messages.where('userId').equals(userId).sortBy('order'),
    ]).then(async ([restoredState, localMessages]) => {
      if (cancelled) return;

      const restoredConversationId =
        restoredState &&
        shouldApplyConversationStateRestore({
          cancelled,
          expectedUserId,
          currentUserId: userIdRef.current,
          restored: restoredState,
        })
          ? restoredState.conversationId
          : null;
      const restoredRecovery = await chatTurnRecoveryCache.readLatestForUser(
        userId,
        restoredConversationId,
      );
      if (cancelled || userIdRef.current !== userId) return;

      chatTurnRecoveryRef.current = restoredRecovery;
      setChatTurnRecovery(restoredRecovery);
      if (restoredConversationId) {
        setConversationId(restoredConversationId);
      } else if (restoredRecovery && conversationIdRef.current === null) {
        setConversationId(restoredRecovery.conversationId);
      }

      const validLocalMessages = selectStoredMessagesForHydration(
        localMessages,
        restoredRecovery !== null,
      );
      if (validLocalMessages.length !== localMessages.length) {
        void saveChatToDb(validLocalMessages);
      }

      setMessages(toRuntimeMessages(validLocalMessages));
      setChatTimestamps(toTimestampMap(validLocalMessages));
      prevMsgIdsRef.current = new Set(validLocalMessages.map((message) => message.id));
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [saveChatToDb, selectStoredMessagesForHydration, setMessages, userId]);

  useEffect(() => {
    const serverData = chatMessagesQuery.data;
    if (!userId || !isHydrated || !serverData || serverMessagesHydratedRef.current) return;

    serverMessagesHydratedRef.current = true;
    void conversationStateRuntimeBridge.acceptServerResult(userId, serverData);

    queueMicrotask(() => {
      if (serverData.conversationId) {
        setConversationId(serverData.conversationId);
      }

      if (serverData.messages.length > 0) {
        const validServerMessages = selectStoredMessagesForHydration(
          serverData.messages,
          chatTurnRecoveryRef.current !== null,
        );
        const serverRuntimeMessages = toRuntimeMessages(validServerMessages);
        setChatTimestamps(toTimestampMap(validServerMessages));
        lastServerSyncKeyRef.current = buildChatSyncSignature(
          validServerMessages,
          serverData.conversationId,
        );
        prevMsgIdsRef.current = new Set(validServerMessages.map((message) => message.id));
        setMessages(serverRuntimeMessages);
        void saveChatToDb(validServerMessages);
        return;
      }

      const localMessages = toStoredMessages(messagesRef.current as RuntimeMessage[]);
      if (
        chatTurnRecoveryRef.current ||
        hasPendingChatTurnHandoff(messagesRef.current as RuntimeMessage[])
      ) {
        return;
      }
      if (localMessages.length === 0) return;

      void syncStoredMessagesToServer(
        localMessages,
        serverData.conversationId,
        '[ChatMessages initial sync]',
      );
    });
  }, [
    chatMessagesQuery.data,
    isHydrated,
    saveChatToDb,
    setMessages,
    syncStoredMessagesToServer,
    selectStoredMessagesForHydration,
    toStoredMessages,
    userId,
  ]);

  useEffect(() => {
    const runtimeMessages = messagesRef.current as RuntimeMessage[];
    const currentIds = new Set(runtimeMessages.map((message) => message.id));
    let changed = false;
    const nextTimestamps = { ...chatTimestampsRef.current };

    for (const message of runtimeMessages) {
      if (!prevMsgIdsRef.current.has(message.id)) {
        nextTimestamps[message.id] = Date.now();
        changed = true;
      }
    }

    prevMsgIdsRef.current = currentIds;
    if (changed) {
      setChatTimestamps(nextTimestamps);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!chatTurnHandoffSignature || !userId || !conversationId) return;
    const latest = getLatestChatTurnHandoff(messagesRef.current as RuntimeMessage[]);
    if (!latest || latest.handoff.conversationId !== conversationId) return;

    let cancelled = false;
    let record: StoredChatTurnRecovery;
    try {
      record = createChatTurnRecoveryRecord({
        userId,
        handoff: latest.handoff,
        placeholderMessageId: latest.message.id,
        createdAt: chatTimestampsRef.current[latest.message.id] ?? Date.now(),
      });
    } catch {
      queueMicrotask(() => {
        if (!cancelled) setChatError('后台回答标识无效，请刷新页面后重试。');
      });
      return;
    }

    if (chatTurnRecoveryRef.current?.id !== record.id) {
      chatTurnRecoveryRef.current = record;
      setChatTurnRecovery(record);
    }
    void chatTurnRecoveryCache.begin(record).then((stored) => {
      if (
        cancelled ||
        userIdRef.current !== userId ||
        conversationIdRef.current !== conversationId ||
        chatTurnRecoveryRef.current?.id !== record.id
      ) {
        return;
      }
      chatTurnRecoveryRef.current = stored;
      setChatTurnRecovery(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [chatTurnHandoffSignature, conversationId, userId]);

  const chatTurnRecoveryId = chatTurnRecovery?.id ?? '';
  useEffect(() => {
    const recovery = chatTurnRecoveryRef.current;
    if (
      !recovery ||
      recovery.id !== chatTurnRecoveryId ||
      !userId ||
      !accessToken ||
      !conversationId ||
      recovery.userId !== userId ||
      recovery.conversationId !== conversationId ||
      !isHydrated ||
      isLoading ||
      (!serverMessagesHydratedRef.current && chatMessagesQuery.isFetching)
    ) {
      return;
    }

    const controller = new AbortController();
    const capturedUserId = userId;
    const capturedAccessToken = accessToken;
    const capturedConversationId = conversationId;
    let lastCheckpointSignature = '';
    const isCurrent = () =>
      !controller.signal.aborted &&
      userIdRef.current === capturedUserId &&
      accessTokenRef.current === capturedAccessToken &&
      conversationIdRef.current === capturedConversationId &&
      chatTurnRecoveryRef.current?.id === recovery.id;

    const applyProgress = (progress: ChatTurnReplayProgress) => {
      if (!isCurrent()) return;
      const checkpointSignature = JSON.stringify({
        status: progress.status,
        transport: progress.transport,
        cursor: progress.cursor,
        lastSequence: progress.lastSequence,
        previewText: progress.previewText,
      });
      if (checkpointSignature !== lastCheckpointSignature) {
        lastCheckpointSignature = checkpointSignature;
        void chatTurnRecoveryCache.checkpoint(recovery.id, capturedUserId, {
          status: progress.status,
          transport: progress.transport,
          cursor: progress.cursor,
          lastSequence: progress.lastSequence,
          previewText: progress.previewText,
        });
      }

      const currentMessages = messagesRef.current as RuntimeMessage[];
      const nextMessages = upsertChatTurnRecoveryMessage(
        currentMessages,
        recovery,
        progress,
      ) as RuntimeMessage[];
      if (nextMessages !== currentMessages) {
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
      }
      if (chatTimestampsRef.current[recovery.placeholderMessageId] === undefined) {
        const nextTimestamps = {
          ...chatTimestampsRef.current,
          [recovery.placeholderMessageId]: recovery.createdAt,
        };
        chatTimestampsRef.current = nextTimestamps;
        setChatTimestamps(nextTimestamps);
      }
    };

    setChatError(null);
    void followChatTurn(
      {
        accessToken: capturedAccessToken,
        turnId: recovery.turnId,
        conversationId: capturedConversationId,
        signal: controller.signal,
        initial: {
          status: recovery.status,
          transport: recovery.transport,
          cursor: recovery.cursor,
          lastSequence: recovery.lastSequence,
          previewText: recovery.previewText,
        },
        onProgress: applyProgress,
      },
      { api: chatTurnReplayApi },
    )
      .then(async (result) => {
        if (!isCurrent()) return;
        if (result.kind === 'succeeded') {
          const nextMessages = resolveChatTurnRecoveryMessage(
            messagesRef.current as RuntimeMessage[],
            recovery,
            result,
          ) as RuntimeMessage[];
          const nextTimestamps = { ...chatTimestampsRef.current };
          delete nextTimestamps[recovery.placeholderMessageId];
          nextTimestamps[result.response.id] = Date.parse(result.response.createdAt);
          chatTimestampsRef.current = nextTimestamps;
          messagesRef.current = nextMessages;
          prevMsgIdsRef.current = new Set(nextMessages.map((message) => message.id));
          setChatTimestamps(nextTimestamps);
          setMessages(nextMessages);

          const storedMessages = toStoredMessages(nextMessages);
          lastServerSyncKeyRef.current = buildChatSyncSignature(
            storedMessages,
            capturedConversationId,
          );
          void saveChatToDb(storedMessages).catch((error) =>
            logBackgroundSyncError('[ChatTurn recovery cache]', error),
          );
          setChatError(null);
        } else {
          const nextMessages = removeChatTurnRecoveryMessage(
            messagesRef.current as RuntimeMessage[],
            recovery.turnId,
          ) as RuntimeMessage[];
          const nextTimestamps = { ...chatTimestampsRef.current };
          delete nextTimestamps[recovery.placeholderMessageId];
          chatTimestampsRef.current = nextTimestamps;
          messagesRef.current = nextMessages;
          setChatTimestamps(nextTimestamps);
          setMessages(nextMessages);
          setChatError(
            result.kind === 'cancelled'
              ? '后台回答已取消，可以重新发送。'
              : '后台回答生成失败，请重新发送。',
          );
        }

        await chatTurnRecoveryCache.remove(recovery.id, capturedUserId);
        if (isCurrent()) {
          chatTurnRecoveryRef.current = null;
          setChatTurnRecovery(null);
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent() || isAbortError(error)) return;
        if (
          error instanceof ChatTurnRecoveryHistoryError ||
          (error instanceof ChatTurnReplayError &&
            (error.code === 'CONTEXT_MISMATCH' || error.code === 'DURABLE_RESPONSE_INVALID'))
        ) {
          const nextMessages = removeChatTurnRecoveryMessage(
            messagesRef.current as RuntimeMessage[],
            recovery.turnId,
          ) as RuntimeMessage[];
          messagesRef.current = nextMessages;
          setMessages(nextMessages);
          void chatTurnRecoveryCache.remove(recovery.id, capturedUserId);
          chatTurnRecoveryRef.current = null;
          setChatTurnRecovery(null);
          setChatError('后台回答上下文不一致，已停止恢复，请刷新页面。');
          return;
        }
        setChatError('后台回答状态暂时无法确认，请刷新页面继续恢复。');
      });

    return () => {
      controller.abort();
    };
  }, [
    accessToken,
    chatMessagesQuery.isFetching,
    chatTurnRecoveryId,
    conversationId,
    isHydrated,
    isLoading,
    saveChatToDb,
    setMessages,
    toStoredMessages,
    userId,
  ]);

  useEffect(() => {
    if (!userId || !isHydrated) return;

    if (!messagesSavedRef.current) {
      messagesSavedRef.current = true;
      return;
    }

    if (isLoading) {
      streamStartedRef.current = true;
      return;
    }

    const settleMs = getChatSyncSettleMs({
      streamStarted: streamStartedRef.current,
      throttleMs: STREAM_UI_THROTTLE_MS,
    });
    const syncTimer = window.setTimeout(() => {
      const runtimeMessages = messagesRef.current as RuntimeMessage[];
      if (chatTurnRecoveryRef.current || hasPendingChatTurnHandoff(runtimeMessages)) {
        lastEmptyAssistantUserMessageIdRef.current = '';
        streamStartedRef.current = false;
        const storedMessages = toStoredMessages(runtimeMessages);
        if (storedMessages.length > 0) void saveChatToDb(storedMessages);
        return;
      }
      const completionGuard = getChatCompletionGuard({
        messages: runtimeMessages,
        isLoading: false,
        streamStarted: streamStartedRef.current,
      });
      if (!completionGuard.canSync) {
        if (
          completionGuard.emptyAssistantReply &&
          completionGuard.userMessageId &&
          completionGuard.userMessageId !== lastEmptyAssistantUserMessageIdRef.current
        ) {
          lastEmptyAssistantUserMessageIdRef.current = completionGuard.userMessageId;
          setChatError(completionGuard.message);
          console.warn('[Chat completion guard] Empty assistant reply after stream completion', {
            userMessageId: completionGuard.userMessageId,
            messageCount: runtimeMessages.length,
          });
          streamStartedRef.current = false;
        }
        return;
      }

      if (chatError === CHAT_EMPTY_ASSISTANT_MESSAGE) {
        setChatError(null);
      }
      lastEmptyAssistantUserMessageIdRef.current = '';
      streamStartedRef.current = false;

      const storedMessages = toStoredMessages(runtimeMessages);
      if (storedMessages.length === 0) return;

      void saveChatToDb(storedMessages);

      void syncStoredMessagesToServer(storedMessages, conversationId, '[ChatMessages sync]');
    }, settleMs);

    return () => {
      window.clearTimeout(syncTimer);
    };
  }, [
    conversationId,
    chatError,
    isHydrated,
    isLoading,
    messageSyncSignature,
    saveChatToDb,
    syncStoredMessagesToServer,
    toStoredMessages,
    userId,
  ]);

  useEffect(() => {
    const flush = () => {
      if (!userId) return;
      const runtimeMessages = messagesRef.current as RuntimeMessage[];
      if (
        !shouldPersistChatSnapshot({
          messages: runtimeMessages,
          isLoading: isLoadingRef.current,
          streamStarted: streamStartedRef.current,
        })
      ) {
        return;
      }

      const storedMessages = toStoredMessages(runtimeMessages);
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

  const handleSubmit = useCallback<ReturnType<typeof useChat>['handleSubmit']>(
    (event, requestOptions) => {
      if (
        chatTurnRecoveryRef.current ||
        hasPendingChatTurnHandoff(messagesRef.current as RuntimeMessage[])
      ) {
        event?.preventDefault?.();
        setChatError('上一条回答仍在后台处理中，请等待完成后再继续发送。');
        return;
      }
      baseHandleSubmit(event, requestOptions);
    },
    [baseHandleSubmit],
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

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

export function useChatRuntime() {
  const value = useContext(ChatRuntimeContext);
  if (!value) {
    throw new Error('useChatRuntime must be used within ChatRuntimeProvider');
  }
  return value;
}
