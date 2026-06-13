import type { OcrRecord, WrongQuestionRecord } from './db';

function shouldKeepUnsyncedLocalItem(item: {
  syncStatus?: string;
  pendingOperation?: string;
}) {
  return Boolean(item.syncStatus && item.syncStatus !== 'synced' && item.pendingOperation !== 'delete');
}

export function mergeWrongQuestionsFromServer(
  serverItems: WrongQuestionRecord[],
  cachedItems: WrongQuestionRecord[],
) {
  const cachedById = new Map(cachedItems.map((item) => [item.id, item]));
  const serverIds = new Set(serverItems.map((item) => item.id));
  const unsyncedLocalItems = cachedItems.filter(
    (item) => shouldKeepUnsyncedLocalItem(item) && !serverIds.has(item.id),
  );

  const mergedServerItems = serverItems.map((item) => ({
    ...item,
    imageUrl: item.imageUrl ?? cachedById.get(item.id)?.imageUrl,
    syncStatus: 'synced' as const,
    syncError: undefined,
    pendingOperation: undefined,
  }));

  return [...unsyncedLocalItems, ...mergedServerItems].sort((a, b) => b.createdAt - a.createdAt);
}

export function mergeOcrRecordsFromServer(
  serverItems: OcrRecord[],
  localItems: OcrRecord[],
) {
  const unsyncedLocalItems = localItems.filter(shouldKeepUnsyncedLocalItem);
  if (serverItems.length === 0) return unsyncedLocalItems;

  const serverGroupIds = new Set(
    serverItems
      .map((item) => item.groupId)
      .filter((groupId): groupId is string => Boolean(groupId)),
  );
  const localUserRecordsByGroup = new Map(
    localItems
      .filter((item): item is OcrRecord & { groupId: string } =>
        Boolean(item.groupId && item.type === 'user' && serverGroupIds.has(item.groupId)),
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
  const serverRecords = serverItems.map((item) => ({
    ...item,
    imageUrl:
      item.imageUrl ?? (item.groupId ? localResultImagesByGroup.get(item.groupId) : undefined),
    syncStatus: 'synced' as const,
    syncError: undefined,
    pendingOperation: undefined,
  }));
  const merged = [...Array.from(localUserRecordsByGroup.values()), ...serverRecords];
  const mergedIds = new Set(merged.map((item) => item.id));

  return [
    ...unsyncedLocalItems.filter((item) => !mergedIds.has(item.id)),
    ...merged,
  ].sort((a, b) => a.createdAt - b.createdAt);
}
