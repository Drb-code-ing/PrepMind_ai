import localforage from "localforage";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface OcrRecord {
  id: string;
  type: "user" | "ocr-loading" | "ocr-result";
  content: string;
  imageUrl?: string;
  createdAt: number;
}

export const messageStorage = localforage.createInstance({
  name: "prepmind",
  storeName: "messages",
});

export const ocrStorage = localforage.createInstance({
  name: "prepmind",
  storeName: "ocr-records",
});
