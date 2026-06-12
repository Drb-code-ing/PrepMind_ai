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
  type ReactNode,
} from 'react';
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';

import { useCreateOcrRecord, useOcrRecords } from '@/hooks/use-ocr-records';
import type { ActiveStudyContext } from '@/lib/chat-context';
import { createThrottledTextPublisher } from '@/lib/throttled-text-publisher';
import { db, type OcrRecord } from '@/lib/db';
import {
  parseOcrResult,
  type OcrResultStatus,
  type ParsedWrongQuestion,
} from '@/lib/wrong-question-parser';
import { useUserStore } from '@/stores/userStore';
import { useChatRuntime } from './chat-runtime-provider';

const STREAM_UI_THROTTLE_MS = 80;

export type OcrRuntimeImage = {
  file: File;
  previewUrl: string;
};

type StartOcrOptions = {
  image: OcrRuntimeImage;
  userText: string;
};

type OcrRuntimeContextValue = {
  ocrMessages: OcrRecord[];
  ocrResultStatuses: Record<string, OcrResultStatus>;
  ocrLoading: boolean;
  startOcr: (options: StartOcrOptions) => Promise<void>;
  stopOcr: () => void;
  isHydrated: boolean;
};

const OcrRuntimeContext = createContext<OcrRuntimeContextValue | null>(null);

function logBackgroundSyncError(scope: string, error: unknown) {
  console.warn(`${scope}: ${error instanceof Error ? error.message : 'unknown error'}`);
}

function createActiveStudyContextFromOcr(record: OcrRecord): ActiveStudyContext | null {
  if (record.type !== 'ocr-result' || !record.content.trim()) return null;
  if (/^(已停止识别|识别失败)/.test(record.content.trim())) return null;

  const parsed = parseOcrResult(record.content);
  if (!parsed.isQuestion) return null;

  return {
    type: 'ocr-question',
    sourceGroupId: record.groupId,
    questionText: parsed.questionText,
    subject: parsed.subject,
    knowledgePoints: parsed.knowledgePoints,
    analysis: parsed.analysis,
    answer: parsed.answer,
    rawContent: parsed.rawContent,
    updatedAt: record.createdAt,
  };
}

function getLatestActiveStudyContext(records: OcrRecord[]) {
  for (const record of [...records].sort((a, b) => b.createdAt - a.createdAt)) {
    const context = createActiveStudyContextFromOcr(record);
    if (context) return context;
  }
  return null;
}

function toOcrParsedPayload(parsed: ParsedWrongQuestion): OcrParsedPayload {
  return {
    isQuestion: parsed.isQuestion,
    nonQuestionSummary: parsed.nonQuestionSummary || undefined,
    subject: parsed.subject || undefined,
    questionText: parsed.questionText || undefined,
    category: parsed.category || undefined,
    knowledgePoints: parsed.knowledgePoints,
    analysis: parsed.analysis || undefined,
    answer: parsed.answer || undefined,
    errorSuggestion: parsed.errorType || undefined,
  };
}

function mergeOcrRecordsPreservingLocalImages(
  serverItems: OcrRecord[],
  localItems: OcrRecord[],
) {
  const serverGroupIds = new Set(
    serverItems.map((item) => item.groupId).filter(Boolean) as string[],
  );
  const localUserRecordsByGroup = new Map(
    localItems
      .filter((item): item is OcrRecord & { groupId: string } =>
        Boolean(item.groupId && item.type === 'user'),
      )
      .map((item) => [item.groupId, item]),
  );
  const localResultImagesByGroup = new Map(
    localItems
      .filter((item): item is OcrRecord & { groupId: string; imageUrl: string } =>
        Boolean(item.groupId && item.type === 'ocr-result' && item.imageUrl),
      )
      .map((item) => [item.groupId, item.imageUrl]),
  );
  const localFallbackResults = localItems.filter(
    (item) => item.type !== 'user' && (!item.groupId || !serverGroupIds.has(item.groupId)),
  );
  const serverResultRecords = serverItems.map((item) => ({
    ...item,
    imageUrl:
      item.imageUrl ?? (item.groupId ? localResultImagesByGroup.get(item.groupId) : undefined),
  }));

  return [
    ...Array.from(localUserRecordsByGroup.values()),
    ...localFallbackResults,
    ...serverResultRecords,
  ].sort((a, b) => a.createdAt - b.createdAt);
}

export function OcrRuntimeProvider({ children }: { children: ReactNode }) {
  const currentUser = useUserStore((state) => state.currentUser);
  const userId = currentUser?.id ?? null;
  const { setActiveStudyContext } = useChatRuntime();
  const [ocrMessages, setOcrMessages] = useState<OcrRecord[]>([]);
  const [ocrResultStatuses, setOcrResultStatuses] = useState<Record<string, OcrResultStatus>>({});
  const [ocrLoading, setOcrLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const ocrAbortControllerRef = useRef<AbortController | null>(null);
  const ocrMsgRef = useRef<OcrRecord[]>(ocrMessages);
  const serverOcrHydratedRef = useRef(false);
  const createOcrRecord = useCreateOcrRecord();
  const ocrRecordsQuery = useOcrRecords({ pageSize: 50 });

  useLayoutEffect(() => {
    ocrMsgRef.current = ocrMessages;
  });

  const saveOcrToDb = useCallback(
    async (records: OcrRecord[]) => {
      if (!userId) return;

      await db.transaction('rw', db.ocrRecords, async () => {
        await db.ocrRecords.where('userId').equals(userId).delete();
        if (records.length > 0) {
          await db.ocrRecords.bulkAdd(records);
        }
      });
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      ocrAbortControllerRef.current?.abort();
      serverOcrHydratedRef.current = false;
      ocrMsgRef.current = [];
      queueMicrotask(() => {
        setOcrMessages([]);
        setOcrResultStatuses({});
        setOcrLoading(false);
        setIsHydrated(false);
      });
      return;
    }

    let cancelled = false;
    serverOcrHydratedRef.current = false;
    queueMicrotask(() => {
      if (!cancelled) setIsHydrated(false);
    });

    db.ocrRecords
      .where('userId')
      .equals(userId)
      .sortBy('createdAt')
      .then((records) => {
        if (cancelled) return;
        ocrMsgRef.current = records;
        setOcrMessages(records);
        setActiveStudyContext(getLatestActiveStudyContext(records));
        setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [setActiveStudyContext, userId]);

  useEffect(() => {
    if (serverOcrHydratedRef.current) return;
    if (!ocrRecordsQuery.data) return;

    serverOcrHydratedRef.current = true;
    const serverItems = ocrRecordsQuery.data.items;
    if (serverItems.length === 0) return;

    const merged = mergeOcrRecordsPreservingLocalImages(serverItems, ocrMsgRef.current);
    ocrMsgRef.current = merged;
    setOcrMessages(merged);
    setActiveStudyContext(getLatestActiveStudyContext(merged));
    void saveOcrToDb(merged);
  }, [ocrRecordsQuery.data, saveOcrToDb, setActiveStudyContext]);

  useEffect(() => {
    const flush = () => {
      const ocr = ocrMsgRef.current;
      if (ocr.length > 0) {
        void saveOcrToDb(ocr);
      }
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
  }, [saveOcrToDb]);

  const startOcr = useCallback(
    async ({ image, userText }: StartOcrOptions) => {
      if (!userId || ocrLoading) return;

      const groupId = `ocr-${Date.now()}`;
      const userMsgId = `${groupId}-user`;
      const resultMsgId = `${groupId}-result`;
      const now = Date.now();

      const initialOcrMsgs: OcrRecord[] = [
        ...ocrMsgRef.current,
        {
          id: userMsgId,
          userId,
          type: 'user',
          groupId,
          content: userText,
          imageUrl: image.previewUrl,
          createdAt: now,
        },
        {
          id: resultMsgId,
          userId,
          type: 'ocr-result',
          groupId,
          content: '',
          createdAt: now + 1,
        },
      ];
      setOcrResultStatuses((prev) => ({ ...prev, [groupId]: 'streaming' }));
      ocrMsgRef.current = initialOcrMsgs;
      setOcrMessages(initialOcrMsgs);
      setActiveStudyContext(null);

      const controller = new AbortController();
      ocrAbortControllerRef.current = controller;
      setOcrLoading(true);

      let fullContent = '';
      const publishOcrContent = (content: string) => {
        setOcrMessages((prev) => {
          const next = prev.map((message) =>
            message.id === resultMsgId ? { ...message, content } : message,
          );
          ocrMsgRef.current = next;
          return next;
        });
      };
      const ocrContentPublisher = createThrottledTextPublisher({
        waitMs: STREAM_UI_THROTTLE_MS,
        publish: publishOcrContent,
      });

      try {
        const formData = new FormData();
        formData.append('image', image.file);
        if (userText) formData.append('text', userText);

        const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || '识别失败');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as { content?: string };
              if (parsed.content) {
                fullContent += parsed.content;
                ocrContentPublisher.push(fullContent);
              }
            } catch {
              // skip unparseable stream chunks
            }
          }
        }
        ocrContentPublisher.flush();

        const finalResultRecord: OcrRecord = {
          id: resultMsgId,
          userId,
          type: 'ocr-result',
          groupId,
          content: fullContent,
          createdAt: Date.now() + 1,
        };
        const parsed = parseOcrResult(fullContent);
        let persistedResultRecord = finalResultRecord;
        try {
          persistedResultRecord = await createOcrRecord.mutateAsync({
            record: finalResultRecord,
            parsedJson: toOcrParsedPayload(parsed),
          });
        } catch (error) {
          logBackgroundSyncError('[OCRRecord sync]', error);
        }

        const finalOcr = ocrMsgRef.current.map((message) =>
          message.id === resultMsgId
            ? {
                ...message,
                id: persistedResultRecord.id,
                content: fullContent,
                imageUrl: message.imageUrl ?? persistedResultRecord.imageUrl,
            }
            : message,
        );
        ocrMsgRef.current = finalOcr;
        setOcrMessages(finalOcr);
        setActiveStudyContext(
          createActiveStudyContextFromOcr({
            ...persistedResultRecord,
            content: fullContent,
            createdAt: finalResultRecord.createdAt,
          }),
        );
        setOcrResultStatuses((prev) => ({ ...prev, [groupId]: 'done' }));
        void saveOcrToDb(finalOcr);
      } catch (error) {
        ocrContentPublisher.cancel();
        const isAbortError = error instanceof DOMException && error.name === 'AbortError';
        const errorMessage = isAbortError
          ? '已停止识别'
          : `识别失败：${error instanceof Error ? error.message : '未知错误'}`;

        setOcrResultStatuses((prev) => ({
          ...prev,
          [groupId]: isAbortError ? 'aborted' : 'failed',
        }));
        const finalOcr = ocrMsgRef.current.map((message) =>
          message.id === resultMsgId ? { ...message, content: errorMessage } : message,
        );
        ocrMsgRef.current = finalOcr;
        setOcrMessages(finalOcr);
        void saveOcrToDb(finalOcr);
      } finally {
        if (ocrAbortControllerRef.current === controller) {
          ocrAbortControllerRef.current = null;
        }
        setOcrLoading(false);
      }
    },
    [
      createOcrRecord,
      ocrLoading,
      saveOcrToDb,
      setActiveStudyContext,
      userId,
    ],
  );

  const stopOcr = useCallback(() => {
    ocrAbortControllerRef.current?.abort();
  }, []);

  const value = useMemo<OcrRuntimeContextValue>(
    () => ({
      ocrMessages,
      ocrResultStatuses,
      ocrLoading,
      startOcr,
      stopOcr,
      isHydrated,
    }),
    [isHydrated, ocrLoading, ocrMessages, ocrResultStatuses, startOcr, stopOcr],
  );

  return <OcrRuntimeContext.Provider value={value}>{children}</OcrRuntimeContext.Provider>;
}

export function useOcrRuntime() {
  const value = useContext(OcrRuntimeContext);
  if (!value) {
    throw new Error('useOcrRuntime must be used within OcrRuntimeProvider');
  }
  return value;
}
