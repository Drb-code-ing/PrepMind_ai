"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import type { OcrRecord } from "@/lib/db";

export const OCR_QUERY_KEY = ["ocr-records"];

export function useOcrRecords() {
  return useQuery<OcrRecord[]>({
    queryKey: OCR_QUERY_KEY,
    queryFn: () => db.ocrRecords.orderBy("createdAt").toArray(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSaveOcrRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: OcrRecord[]) => {
      await db.transaction("rw", db.ocrRecords, async () => {
        await db.ocrRecords.clear();
        await db.ocrRecords.bulkAdd(records);
      });
    },
    onSuccess: (_, records) => qc.setQueryData(OCR_QUERY_KEY, records),
  });
}
