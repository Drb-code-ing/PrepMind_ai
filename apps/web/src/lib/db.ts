import Dexie, { type Table } from "dexie";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  order: number;
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
});
