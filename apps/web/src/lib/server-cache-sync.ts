import type { OcrRecord, WrongQuestionRecord } from './db';

export function mergeWrongQuestionsFromServer(
  serverItems: WrongQuestionRecord[],
  cachedItems: WrongQuestionRecord[],
) {
  const cachedById = new Map(cachedItems.map((item) => [item.id, item]));

  return serverItems.map((item) => ({
    ...item,
    imageUrl: item.imageUrl ?? cachedById.get(item.id)?.imageUrl,
  }));
}

export function mergeOcrRecordsFromServer(
  serverItems: OcrRecord[],
  localItems: OcrRecord[],
) {
  if (serverItems.length === 0) return [];

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
  }));

  return [...Array.from(localUserRecordsByGroup.values()), ...serverRecords].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
}
