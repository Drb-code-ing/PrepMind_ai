'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookMarked,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  KnowledgeDocumentListQuery,
  KnowledgeDocumentResponse,
  KnowledgeSearchHit,
} from '@repo/types/api/knowledge';

import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocumentList,
  useProcessKnowledgeDocument,
  useSearchKnowledge,
  useUploadKnowledgeDocument,
} from '@/hooks/use-knowledge';
import {
  formatKnowledgeDateTime,
  formatKnowledgeFileSize,
  getKnowledgeDocumentAction,
  getKnowledgeDocumentStatusMeta,
  getKnowledgeSearchHitSummary,
} from '@/lib/knowledge-view';
import { getMutationErrorMessage } from '@/lib/mutation-queue';

type NoticeTone = 'success' | 'danger' | 'neutral';
type ActionNotice = { message: string; tone: NoticeTone };

const acceptedKnowledgeFileTypes = [
  '.pdf',
  '.docx',
  '.md',
  '.markdown',
  '.txt',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
].join(',');
const noticeDurationMs = 2200;
const maxDocumentErrorLength = 160;
const knowledgeDocumentListQuery = { limit: 50 } satisfies KnowledgeDocumentListQuery;

const noticeStyles: Record<NoticeTone, { icon: LucideIcon; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-100 bg-emerald-50/95 text-emerald-700',
  },
  danger: {
    icon: X,
    className: 'border-red-100 bg-red-50/95 text-red-700',
  },
  neutral: {
    icon: Sparkles,
    className: 'border-amber-100 bg-[#fff7df]/95 text-[#8a641c]',
  },
};

export default function KnowledgePage() {
  const documentsQuery = useKnowledgeDocumentList(knowledgeDocumentListQuery);
  const uploadDocument = useUploadKnowledgeDocument();
  const processDocument = useProcessKnowledgeDocument();
  const deleteDocument = useDeleteKnowledgeDocument();
  const searchKnowledge = useSearchKnowledge();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const searchRequestSeqRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<KnowledgeSearchHit[] | null>(null);
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const documentItems = documentsQuery.data?.items;
  const documents = useMemo(() => documentItems ?? [], [documentItems]);
  const summary = useMemo(() => getKnowledgeSummary(documents), [documents]);
  const documentMutationPending = processDocument.isPending || deleteDocument.isPending;

  const showNotice = (message: string, tone: NoticeTone = 'success') => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice({ message, tone });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, noticeDurationMs);
  };

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  async function handleUpload() {
    const file = selectedFile;

    if (!file) {
      showNotice('先选择一个 PDF、DOCX、Markdown 或 TXT 文件。', 'neutral');
      return;
    }

    try {
      await uploadDocument.mutateAsync(file);
      showNotice(`已上传《${file.name}》，可以开始处理。`);
      setSelectedFile((current) => (current === file ? null : current));
      if (fileInputRef.current?.files?.[0] === file) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'danger');
    }
  }

  async function handleProcess(document: KnowledgeDocumentResponse) {
    const action = getKnowledgeDocumentAction(document.status);
    if (
      action.disabled ||
      documentMutationPending ||
      pendingDeleteId === document.id ||
      deletingId === document.id
    ) {
      return;
    }

    setProcessingId(document.id);
    try {
      const processed = await processDocument.mutateAsync({
        documentId: document.id,
        request: { force: action.force },
      });
      showNotice(`《${document.name}》处理完成，当前 ${processed.chunkCount} 个片段。`);
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'danger');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(document: KnowledgeDocumentResponse) {
    if (documentMutationPending || processingId === document.id) {
      return;
    }

    setDeletingId(document.id);
    try {
      await deleteDocument.mutateAsync(document.id);
      setPendingDeleteId(null);
      setSearchHits((current) =>
        current ? current.filter((hit) => hit.documentId !== document.id) : current,
      );
      showNotice(`已删除《${document.name}》。`);
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'danger');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      showNotice('先输入一个想验证的问题。', 'neutral');
      return;
    }

    const requestSeq = searchRequestSeqRef.current + 1;
    searchRequestSeqRef.current = requestSeq;
    setSubmittedSearchQuery(query);
    setSearchHits(null);

    try {
      const result = await searchKnowledge.mutateAsync({ query, topK: 5, minScore: 0.7 });
      if (searchRequestSeqRef.current === requestSeq) {
        setSearchHits(result.hits);
      }
    } catch (error) {
      if (searchRequestSeqRef.current === requestSeq) {
        setSearchHits(null);
        showNotice(getMutationErrorMessage(error), 'danger');
      }
    }
  }

  function handleSearchQueryChange(value: string) {
    setSearchQuery(value);
    if (searchHits !== null || submittedSearchQuery) {
      searchRequestSeqRef.current += 1;
      setSearchHits(null);
      setSubmittedSearchQuery('');
    }
  }

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex w-full items-center gap-3 sm:max-w-3xl">
          <Link
            href="/chat"
            aria-label="返回聊天"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">Knowledge base</p>
            <h1 className="text-lg font-semibold leading-tight">知识库</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">
              上传资料，让 AI 回答有据可查
            </p>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff7d6] text-[#247269] ring-1 ring-[#f3e6a8]">
            <BookMarked className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        {notice ? <ActionNoticeBar notice={notice} /> : null}

        <KnowledgeSummaryCard summary={summary} />

        <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
          <SectionTitle
            icon={UploadCloud}
            title="上传资料"
            subtitle="支持 PDF、DOCX、Markdown 和 TXT"
          />
          <div className="mt-4 rounded-[1.25rem] bg-white/65 p-3 ring-1 ring-[var(--pm-line)]">
            <input
              ref={fileInputRef}
              id="knowledge-document-file"
              type="file"
              accept={acceptedKnowledgeFileTypes}
              disabled={uploadDocument.isPending}
              className="sr-only"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label
                htmlFor="knowledge-document-file"
                aria-disabled={uploadDocument.isPending}
                className={`tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold ring-1 transition-all active:scale-[0.98] ${
                  uploadDocument.isPending
                    ? 'cursor-not-allowed bg-white/70 text-[var(--pm-muted)] opacity-65 ring-[var(--pm-line)]'
                    : 'cursor-pointer bg-[#eafff9] text-[#247269] ring-[#bdeee5] hover:bg-[#d8fbf3]'
                }`}
              >
                <FileText className="h-4 w-4" />
                {uploadDocument.isPending ? '上传中' : '选择文件'}
              </label>
              <div className="min-w-0 flex-1">
                {selectedFile ? (
                  <>
                    <p className="break-all text-sm font-semibold leading-5">
                      {selectedFile.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--pm-muted)]">
                      {formatKnowledgeFileSize(selectedFile.size)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-[var(--pm-muted)]">
                    选择一份备考资料后上传到知识库。
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploadDocument.isPending}
            className="tap-target mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#86dccf] px-4 text-sm font-semibold text-[#173b37] shadow-sm transition-all hover:bg-[#70cfc1] active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)] disabled:active:scale-100"
          >
            {uploadDocument.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {uploadDocument.isPending ? '上传中...' : '上传到知识库'}
          </button>
        </section>

        <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
          <SectionTitle icon={BookMarked} title="资料列表" subtitle="处理完成后会进入 Chat RAG" />
          {documentsQuery.isLoading ? (
            <LoadingPanel message="正在读取知识库资料..." />
          ) : documentsQuery.isError ? (
            <ErrorPanel
              message="知识库资料读取失败，请稍后重试。"
              actionLabel="重新读取"
              onRetry={() => void documentsQuery.refetch()}
            />
          ) : documents.length === 0 ? (
            <EmptyDocuments />
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((document) => (
                <KnowledgeDocumentCard
                  key={document.id}
                  document={document}
                  pendingDelete={pendingDeleteId === document.id}
                  actionPending={processingId === document.id && processDocument.isPending}
                  deletePending={deletingId === document.id && deleteDocument.isPending}
                  documentMutationPending={documentMutationPending}
                  onProcess={() => void handleProcess(document)}
                  onRequestDelete={() => setPendingDeleteId(document.id)}
                  onCancelDelete={() => setPendingDeleteId(null)}
                  onConfirmDelete={() => void handleDelete(document)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
          <SectionTitle icon={Search} title="检索测试" subtitle="用同一套检索参数预览命中片段" />
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSearch();
            }}
          >
            <input
              value={searchQuery}
              onChange={(event) => handleSearchQueryChange(event.target.value)}
              maxLength={2000}
              className="min-h-11 min-w-0 flex-1 rounded-2xl border border-[var(--pm-line)] bg-white/80 px-3 text-base outline-none transition-all placeholder:text-[var(--pm-muted)] focus:border-[#6fcbbf] focus:ring-4 focus:ring-[#d8f8f0]"
              placeholder="例如：这份资料里怎么解释导数？"
            />
            <button
              type="submit"
              disabled={searchKnowledge.isPending}
              className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)]"
            >
              {searchKnowledge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              搜索
            </button>
          </form>

          <SearchResults
            hits={searchHits}
            loading={searchKnowledge.isPending}
            submittedQuery={submittedSearchQuery}
          />
        </section>
      </main>
    </div>
  );
}

function getKnowledgeSummary(documents: KnowledgeDocumentResponse[]) {
  return documents.reduce(
    (summary, document) => {
      summary.total += 1;
      if (document.status === 'DONE') summary.done += 1;
      if (document.status === 'PROCESSING') summary.processing += 1;
      if (document.status === 'FAILED') summary.failed += 1;
      if (document.status === 'PENDING') summary.pending += 1;
      return summary;
    },
    {
      total: 0,
      done: 0,
      processing: 0,
      failed: 0,
      pending: 0,
    },
  );
}

function ActionNoticeBar({ notice }: { notice: ActionNotice }) {
  const NoticeIcon = noticeStyles[notice.tone].icon;

  return (
    <div
      role={notice.tone === 'danger' ? 'alert' : 'status'}
      className={`pm-enter mb-3 flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold shadow-sm ${noticeStyles[notice.tone].className}`}
    >
      <NoticeIcon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{notice.message}</span>
    </div>
  );
}

function KnowledgeSummaryCard({ summary }: { summary: ReturnType<typeof getKnowledgeSummary> }) {
  return (
    <section className="pm-glass-card pm-enter rounded-[1.6rem] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--pm-muted)]">Workspace summary</p>
          <p className="mt-1 text-3xl font-black leading-none text-[var(--pm-ink)]">
            {summary.total}
          </p>
          <p className="mt-1 text-xs text-[var(--pm-muted)]">当前资料总数</p>
        </div>
        <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-[#eafff9] px-3 text-xs font-bold text-[#247269] ring-1 ring-[#bdeee5]">
          <Sparkles className="h-4 w-4" />
          Chat RAG 已接入
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryStat label="已入库" value={summary.done} className="bg-emerald-50/80 text-emerald-700" />
        <SummaryStat label="处理中" value={summary.processing} className="bg-sky-50/80 text-sky-700" />
        <SummaryStat label="失败" value={summary.failed} className="bg-red-50/80 text-red-700" />
        <SummaryStat label="待处理" value={summary.pending} className="bg-amber-50/80 text-amber-700" />
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-2xl px-3 py-2 ring-1 ring-[var(--pm-line)] ${className}`}>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-[var(--pm-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="mt-4 flex min-h-24 min-w-0 items-center gap-2 break-words rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="min-w-0 flex-1">{message}</span>
    </div>
  );
}

function ErrorPanel({
  message,
  actionLabel,
  onRetry,
}: {
  message: string;
  actionLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-red-50/85 px-3 py-3 text-sm leading-6 text-red-600 ring-1 ring-red-100">
      <p className="font-semibold">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="tap-target mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-bold text-red-600 ring-1 ring-red-100 transition-all hover:bg-red-50 active:scale-[0.98]"
      >
        <RefreshCw className="h-4 w-4" />
        {actionLabel}
      </button>
    </div>
  );
}

function EmptyDocuments() {
  return (
    <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-[1.35rem] bg-white/60 px-6 text-center ring-1 ring-[var(--pm-line)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#eafff9] text-[#247269] ring-1 ring-[#bdeee5]">
        <UploadCloud className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold">还没有资料</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
        上传后先处理入库，Chat 才能在回答时引用这些资料。
      </p>
    </div>
  );
}

function KnowledgeDocumentCard({
  document,
  pendingDelete,
  actionPending,
  deletePending,
  documentMutationPending,
  onProcess,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  document: KnowledgeDocumentResponse;
  pendingDelete: boolean;
  actionPending: boolean;
  deletePending: boolean;
  documentMutationPending: boolean;
  onProcess: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const statusMeta = getKnowledgeDocumentStatusMeta(document.status);
  const action = getKnowledgeDocumentAction(document.status);
  const processDisabled = action.disabled || pendingDelete || documentMutationPending;
  const confirmDeleteDisabled = documentMutationPending || actionPending;
  const requestDeleteDisabled = documentMutationPending || actionPending || deletePending;

  return (
    <article className="rounded-[1.35rem] bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff7d6] text-[#247269] ring-1 ring-[#f3e6a8]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="min-w-0 break-all text-sm font-semibold leading-6">{document.name}</h3>
            <span
              className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <DocumentMeta label="类型" value={document.type} />
            <DocumentMeta label="大小" value={formatKnowledgeFileSize(document.size)} />
            <DocumentMeta label="片段" value={`${document.chunkCount} 个`} />
            <DocumentMeta label="处理时间" value={formatKnowledgeDateTime(document.processedAt)} />
          </div>

          {document.errorMessage ? (
            <p className="mt-3 break-words rounded-2xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-600 ring-1 ring-red-100">
              {formatDocumentErrorMessage(document.errorMessage)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {pendingDelete ? (
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={confirmDeleteDisabled}
              className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 text-sm font-semibold text-red-600 ring-1 ring-red-100 transition-all hover:bg-red-100 active:scale-[0.98] disabled:opacity-60"
            >
              {deletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认删除
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={deletePending}
              className="tap-target inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/75 px-3 text-sm font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98] disabled:opacity-60"
            >
              取消
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onProcess}
              disabled={processDisabled}
              className="tap-target inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)] disabled:active:scale-100"
            >
              {actionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {actionPending ? '处理中...' : action.label}
            </button>
            <button
              type="button"
              onClick={onRequestDelete}
              disabled={requestDeleteDisabled}
              className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/75 px-4 text-sm font-semibold text-red-600 ring-1 ring-red-100 transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function DocumentMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/65 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <p className="text-[11px] font-medium text-[var(--pm-muted)]">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-[var(--pm-ink)]">{value}</p>
    </div>
  );
}

function formatDocumentErrorMessage(errorMessage: string) {
  const normalized = errorMessage.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '处理失败，请重新处理或换一份资料。';
  }

  if (normalized.length <= maxDocumentErrorLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxDocumentErrorLength)}...`;
}

function SearchResults({
  hits,
  loading,
  submittedQuery,
}: {
  hits: KnowledgeSearchHit[] | null;
  loading: boolean;
  submittedQuery: string;
}) {
  if (loading) {
    return (
      <LoadingPanel
        message={submittedQuery ? `正在检索“${submittedQuery}”...` : '正在检索资料片段...'}
      />
    );
  }

  if (hits === null) {
    return (
      <p className="mt-3 rounded-2xl bg-white/55 px-3 py-3 text-sm leading-6 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
        输入问题后可以预览 Chat 会参考哪些资料片段。
      </p>
    );
  }

  if (hits.length === 0) {
    return (
      <div className="mt-3 rounded-2xl bg-[#fff7df]/80 px-3 py-3 text-sm leading-6 text-[#8a641c] ring-1 ring-amber-100">
        {submittedQuery ? (
          <p className="mb-1 break-words text-xs font-bold">上次检索：{submittedQuery}</p>
        ) : null}
        没有命中资料。Chat 仍会按普通 AI 能力回答。
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {submittedQuery ? (
        <p className="rounded-2xl bg-white/55 px-3 py-2 text-xs font-bold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
          上次检索：
          <span className="break-words text-[var(--pm-ink)]">{submittedQuery}</span>
        </p>
      ) : null}
      {hits.map((hit) => (
        <article key={hit.chunkId} className="rounded-[1.25rem] bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
          <p className="break-words text-xs font-bold text-[#247269]">
            {getKnowledgeSearchHitSummary(hit)}
          </p>
          <p className="mt-2 line-clamp-4 break-words text-sm leading-6 text-[var(--pm-ink)]">
            {hit.content}
          </p>
        </article>
      ))}
    </div>
  );
}
