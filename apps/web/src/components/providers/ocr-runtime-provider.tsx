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

import { useCreateOcrRecord, useOcrRecords } from '@/hooks/use-ocr-records';
import { useUploadImage } from '@/hooks/use-upload-image';
import type { ActiveStudyContext } from '@/lib/chat-context';
import { createThrottledTextPublisher } from '@/lib/throttled-text-publisher';
import { db, type OcrRecord } from '@/lib/db';
import {
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getMutationErrorMessage,
} from '@/lib/mutation-queue';
import {
  buildActiveStudyContextFromOcrQuestion,
  getPrimaryOcrQuestion,
  normalizeOcrParsedPayload,
  toOcrStructuredResult,
} from '@/lib/ocr-structured-result';
import { mergeOcrRecordsFromServer } from '@/lib/server-cache-sync';
import { type OcrResultStatus } from '@/lib/wrong-question-parser';
import { useUserStore } from '@/stores/userStore';
import { useChatRuntime } from './chat-runtime-provider';

const STREAM_UI_THROTTLE_MS = 120;

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

  const structuredResult = record.parsedJson
    ? normalizeOcrParsedPayload(record.parsedJson, record.content)
    : toOcrStructuredResult(record.content);
  const primaryQuestion = getPrimaryOcrQuestion(structuredResult);
  if (!primaryQuestion) return null;

  return buildActiveStudyContextFromOcrQuestion(primaryQuestion, {
    sourceGroupId: record.groupId,
    rawContent: structuredResult.rawText || record.content,
    updatedAt: record.createdAt,
  });
}

function getLatestActiveStudyContext(records: OcrRecord[]) {
  for (const record of [...records].sort((a, b) => b.createdAt - a.createdAt)) {
    const context = createActiveStudyContextFromOcr(record);
    if (context) return context;
  }
  return null;
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
  const uploadImage = useUploadImage();
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

    const merged = mergeOcrRecordsFromServer(serverItems, ocrMsgRef.current);
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
      let uploadedImageUrl: string | undefined;
      const uploadPromise = uploadImage
        .mutateAsync({
          file: image.file,
          purpose: 'ocr',
          groupId,
        })
        .then((uploaded) => {
          uploadedImageUrl = uploaded.imageUrl;
          const withServerImage = ocrMsgRef.current.map((message) =>
            message.groupId === groupId && message.type === 'user'
              ? { ...message, imageUrl: uploaded.imageUrl }
              : message,
          );
          ocrMsgRef.current = withServerImage;
          setOcrMessages(withServerImage);
          void saveOcrToDb(withServerImage);
          return uploaded;
        })
        .catch((error) => {
          logBackgroundSyncError('[Image upload]', error);
          return null;
        });
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
        await uploadPromise;

        const structuredResult = toOcrStructuredResult(fullContent, 'mimo-v2.5');
        const finalResultRecord: OcrRecord = {
          id: resultMsgId,
          userId,
          type: 'ocr-result',
          groupId,
          content: fullContent,
          parsedJson: structuredResult,
          imageUrl: uploadedImageUrl,
          createdAt: Date.now() + 1,
        };
        let persistedResultRecord = finalResultRecord;
        try {
          persistedResultRecord = await createOcrRecord.mutateAsync({
            record: finalResultRecord,
            parsedJson: structuredResult,
          });
        } catch (error) {
          const errorMessage = getMutationErrorMessage(error);
          persistedResultRecord = {
            ...finalResultRecord,
            syncStatus: 'failed',
            syncError: errorMessage,
            pendingOperation: 'create',
          };
          await enqueueMutationQueueItem(
            createMutationQueueItem({
              userId,
              entity: 'ocrRecord',
              operation: 'create',
              entityId: finalResultRecord.id,
              payload: {
                record: finalResultRecord,
                parsedJson: structuredResult,
              },
            }),
          );
          logBackgroundSyncError('[OCRRecord sync]', error);
        }

        const finalOcr = ocrMsgRef.current.map((message) => {
          if (message.groupId !== groupId) return message;
          if (message.id === resultMsgId) {
            return {
              ...message,
              id: persistedResultRecord.id,
              content: fullContent,
              parsedJson: persistedResultRecord.parsedJson ?? structuredResult,
              imageUrl:
                persistedResultRecord.imageUrl ?? uploadedImageUrl ?? message.imageUrl,
              syncStatus: persistedResultRecord.syncStatus,
              syncError: persistedResultRecord.syncError,
              pendingOperation: persistedResultRecord.pendingOperation,
            };
          }
          if (message.type === 'user' && uploadedImageUrl) {
            return { ...message, imageUrl: uploadedImageUrl };
          }
          return message;
        });
        ocrMsgRef.current = finalOcr;
        setOcrMessages(finalOcr);
        setActiveStudyContext(
          createActiveStudyContextFromOcr({
            ...persistedResultRecord,
            content: fullContent,
            parsedJson: persistedResultRecord.parsedJson ?? structuredResult,
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
      uploadImage,
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
