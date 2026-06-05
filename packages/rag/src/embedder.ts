/**
 * 向量化（Embedding）
 * TODO: Phase 5 实现 — 使用 bge-m3
 */
export const embedder = {
  embed: async (_text: string): Promise<number[]> => {
    throw new Error('Not implemented');
  },
  embedBatch: async (_texts: string[]): Promise<number[][]> => {
    throw new Error('Not implemented');
  },
};
