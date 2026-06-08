import Dexie, { type Table } from "dexie";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  order: number;
  createdAt: number;
}

export interface OcrRecord {
  id: string;
  type: "user" | "ocr-loading" | "ocr-result";
  content: string;
  imageUrl?: string;
  createdAt: number;
}

class PrepMindDB extends Dexie {
  messages!: Table<StoredMessage, string>;
  ocrRecords!: Table<OcrRecord, string>;
}

export const db = new PrepMindDB("prepmind-db");

db.version(1).stores({
  messages: "id, role",
  ocrRecords: "id, type, createdAt",
});

db.version(2).stores({
  messages: "id, role, order",
  ocrRecords: "id, type, createdAt",
});

db.version(3).stores({
  messages: "id, role, order, createdAt",
  ocrRecords: "id, type, createdAt",
}).upgrade(async (tx) => {
  // Populate createdAt for existing messages that lack it
  const baseTime = Date.now();
  await tx.table("messages").toCollection().modify((msg) => {
    if (!msg.createdAt) {
      msg.createdAt = baseTime - (1000 * (msg.order || 0));
    }
  });
});
