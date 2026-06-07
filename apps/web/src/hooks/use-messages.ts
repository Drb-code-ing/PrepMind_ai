"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messageStorage } from "@/lib/storage";
import type { StoredMessage } from "@/lib/storage";

export const MESSAGE_QUERY_KEY = ["messages"];

export function usePersistedMessages() {
  return useQuery<StoredMessage[]>({
    queryKey: MESSAGE_QUERY_KEY,
    queryFn: () =>
      messageStorage.getItem<StoredMessage[]>("chat").then((v) => v ?? []),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSaveMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (msgs: StoredMessage[]) =>
      messageStorage.setItem("chat", msgs),
    onSuccess: (_, msgs) => qc.setQueryData(MESSAGE_QUERY_KEY, msgs),
  });
}

export function useClearMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => messageStorage.removeItem("chat"),
    onSuccess: () => qc.setQueryData(MESSAGE_QUERY_KEY, []),
  });
}
