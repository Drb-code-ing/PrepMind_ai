"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ocrStorage } from "@/lib/storage";
import type { OcrRecord } from "@/lib/storage";

export const OCR_QUERY_KEY = ["ocr-records"];

export function useOcrRecords() {
  return useQuery<OcrRecord[]>({
    queryKey: OCR_QUERY_KEY,
    queryFn: () =>
      ocrStorage.getItem<OcrRecord[]>("records").then((v) => v ?? []),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSaveOcrRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: OcrRecord[]) =>
      ocrStorage.setItem("records", records),
    onSuccess: (_, records) => qc.setQueryData(OCR_QUERY_KEY, records),
  });
}
