export enum DocumentType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  MD = 'MD',
  TXT = 'TXT',
}

export enum ProcessStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  mimeType: string;
  storageKey: string;
  status: ProcessStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  index: number;
  userId: string;
  createdAt: Date;
}
