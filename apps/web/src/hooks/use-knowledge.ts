'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  KnowledgeDocumentListQuery,
  KnowledgeDocumentProcessRequest,
  KnowledgeSearchRequest,
} from '@repo/types/api/knowledge';

import { knowledgeApi } from '@/lib/knowledge-api';
import { knowledgeAgentQueryKeys } from '@/lib/knowledge-agent-query-keys';
import { useUserStore } from '@/stores/userStore';

export const knowledgeQueryKeys = {
  all: ['knowledge'] as const,
  documents: () => [...knowledgeQueryKeys.all, 'documents'] as const,
  documentList: (query: KnowledgeDocumentListQuery) =>
    [...knowledgeQueryKeys.documents(), 'list', query] as const,
  documentDetail: (documentId: string) =>
    [...knowledgeQueryKeys.documents(), 'detail', documentId] as const,
  search: () => [...knowledgeQueryKeys.all, 'search'] as const,
};

export function useKnowledgeDocumentList(query: KnowledgeDocumentListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: knowledgeQueryKeys.documentList(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.listDocuments(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useKnowledgeDocumentDetail(documentId: string | null) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: knowledgeQueryKeys.documentDetail(documentId ?? ''),
    queryFn: async () => {
      if (!accessToken || !documentId) {
        throw new Error('Missing knowledge document context');
      }
      return knowledgeApi.getDocument(accessToken, documentId);
    },
    enabled: sessionHydrated && !!accessToken && !!documentId,
    retry: false,
  });
}

export function useUploadKnowledgeDocument() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (file: File) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.uploadDocument(accessToken, file);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() });
      void queryClient.invalidateQueries({ queryKey: knowledgeAgentQueryKeys.all });
    },
  });
}

export function useReplaceKnowledgeDocumentFile() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      documentId,
      file,
    }: {
      documentId: string;
      file: File;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.replaceDocumentFile(accessToken, documentId, file);
    },
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() });
      void queryClient.invalidateQueries({
        queryKey: knowledgeQueryKeys.documentDetail(document.id),
      });
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.search() });
      void queryClient.invalidateQueries({ queryKey: knowledgeAgentQueryKeys.all });
    },
  });
}

export function useProcessKnowledgeDocument() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      documentId,
      request,
    }: {
      documentId: string;
      request: KnowledgeDocumentProcessRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.processDocument(accessToken, documentId, request);
    },
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() });
      void queryClient.invalidateQueries({
        queryKey: knowledgeQueryKeys.documentDetail(document.id),
      });
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.search() });
      void queryClient.invalidateQueries({ queryKey: knowledgeAgentQueryKeys.all });
    },
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.deleteDocument(accessToken, documentId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() });
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.search() });
      void queryClient.invalidateQueries({ queryKey: knowledgeAgentQueryKeys.all });
    },
  });
}

export function useSearchKnowledge() {
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationKey: knowledgeQueryKeys.search(),
    mutationFn: async (request: KnowledgeSearchRequest) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.search(accessToken, request);
    },
  });
}
