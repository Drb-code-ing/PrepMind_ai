"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import type { StoredMessage } from "@/lib/db";

export const MESSAGE_QUERY_KEY = ["messages"];

export function usePersistedMessages() {
  return useQuery<StoredMessage[]>({
    queryKey: MESSAGE_QUERY_KEY,
    queryFn: () => db.messages.toArray(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSaveMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msgs: StoredMessage[]) => {
      await db.transaction("rw", db.messages, async () => {
        await db.messages.clear();
        await db.messages.bulkAdd(msgs);
      });
    },
    onSuccess: (_, msgs) => qc.setQueryData(MESSAGE_QUERY_KEY, msgs),
  });
}

export function useClearMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => db.messages.clear(),
    onSuccess: () => qc.setQueryData(MESSAGE_QUERY_KEY, []),
  });
}
