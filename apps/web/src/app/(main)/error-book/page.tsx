'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Trash2, X } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { db } from '@/lib/db';
import type { WrongQuestionRecord, WrongQuestionStatus } from '@/lib/db';
import { formatOcrContentForDisplay } from '@/lib/wrong-question-parser';
import { Textarea } from '@/components/ui/textarea';

type StatusFilter = 'all' | WrongQuestionStatus;

const statusLabels: Record<WrongQuestionStatus, string> = {
  unresolved: '未掌握',
  resolved: '已掌握',
};
const remarkPlugins = [remarkGfm];

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function getSummary(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export default function ErrorBookPage() {
  const [items, setItems] = useState<WrongQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState('全部');
  const [selected, setSelected] = useState<WrongQuestionRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = new Promise<WrongQuestionRecord[]>((_, reject) => {
      window.setTimeout(() => reject(new Error('本地数据库升级超时')), 3000);
    });

    void Promise.race([db.wrongQuestions.orderBy('createdAt').reverse().toArray(), timeout])
      .then((records) => {
        if (cancelled) return;
        setItems(records);
        setLoadError('');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[WrongQuestions]', error);
        setLoadError('本地数据库正在升级。请关闭其他 PrepMind 标签页后刷新。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const subjects = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => item.subject || '其他')));
    return ['全部', ...values];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const statusMatched = statusFilter === 'all' || item.status === statusFilter;
      const subjectMatched = subjectFilter === '全部' || item.subject === subjectFilter;
      return statusMatched && subjectMatched;
    });
  }, [items, statusFilter, subjectFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unresolved: items.filter((item) => item.status === 'unresolved').length,
      resolved: items.filter((item) => item.status === 'resolved').length,
    };
  }, [items]);

  const updateItem = async (id: string, patch: Partial<WrongQuestionRecord>) => {
    const updatedAt = Number(new Date());
    await db.wrongQuestions.update(id, { ...patch, updatedAt });
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch, updatedAt } : item)),
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch, updatedAt } : prev));
  };

  const deleteItem = async (id: string) => {
    const confirmed = window.confirm('删除后无法恢复，确认删除这道错题？');
    if (!confirmed) return;

    await db.wrongQuestions.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelected(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
            aria-label="返回聊天"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">错题本</h1>
            <p className="text-xs text-muted-foreground">本地保存，Phase 2 接入数据库后迁移</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="全部" value={stats.total} />
          <StatBox label="未掌握" value={stats.unresolved} />
          <StatBox label="已掌握" value={stats.resolved} />
        </div>
      </header>

      <main className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {[
            { value: 'all', label: '全部' },
            { value: 'unresolved', label: '未掌握' },
            { value: 'resolved', label: '已掌握' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatusFilter(item.value as StatusFilter)}
              className={`tap-target shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                statusFilter === item.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-1 flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
          {subjects.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => setSubjectFilter(subject)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium transition-colors ${
                subjectFilter === subject
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : loadError ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
            <p className="text-sm font-medium">错题本暂时不可用</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="tap-target mt-4 flex items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              刷新页面
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState hasAny={items.length > 0} />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <WrongQuestionCard
                key={item.id}
                item={item}
                onOpen={() => setSelected(item)}
                onToggleStatus={() =>
                  updateItem(item.id, {
                    status: item.status === 'resolved' ? 'unresolved' : 'resolved',
                  })
                }
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <WrongQuestionDetail
          key={selected.id}
          item={selected}
          onClose={() => setSelected(null)}
          onDelete={() => deleteItem(selected.id)}
          onUpdate={(patch) => updateItem(selected.id, patch)}
        />
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
      <BookOpen className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{hasAny ? '当前筛选下没有错题' : '还没有保存错题'}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        拍照识题后，在 AI 识别结果下方点击保存到错题本。
      </p>
      {!hasAny && (
        <Link
          href="/chat"
          className="tap-target mt-4 flex items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          去拍照识题
        </Link>
      )}
    </div>
  );
}

function WrongQuestionCard({
  item,
  onOpen,
  onToggleStatus,
  onDelete,
}: {
  item: WrongQuestionRecord;
  onOpen: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-3">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{item.subject || '其他'}</Badge>
              <Badge subtle>{item.errorType || '其他'}</Badge>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  item.status === 'resolved'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {statusLabels[item.status]}
              </span>
            </div>
            <p className="mt-2 max-h-12 overflow-hidden text-sm font-medium leading-6">
              {getSummary(item.questionText)}
            </p>
          </div>
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt="错题图片"
              className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-border"
            />
          )}
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleStatus}
            className="tap-target flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <CheckCircle2 className="h-4 w-4" />
            {item.status === 'resolved' ? '标为未掌握' : '标为已掌握'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="tap-target flex h-9 w-9 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
            aria-label="删除错题"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function WrongQuestionDetail({
  item,
  onClose,
  onDelete,
  onUpdate,
}: {
  item: WrongQuestionRecord;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<WrongQuestionRecord>) => void;
}) {
  const [note, setNote] = useState(item.userNote);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">错题详情</h2>
          <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="tap-target flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="h-[calc(100dvh-4rem)] overflow-y-auto px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{item.subject || '其他'}</Badge>
          <Badge subtle>{item.category || '未分类'}</Badge>
          <Badge subtle>{item.errorType || '其他'}</Badge>
        </div>

        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt="错题图片"
            className="mt-4 max-h-80 w-full rounded-lg object-contain ring-1 ring-border"
          />
        )}

        <DetailSection title="题目" content={item.questionText} />
        {item.knowledgePoints.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-semibold">知识点</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.knowledgePoints.map((point) => (
                <Badge key={point} subtle>
                  {point}
                </Badge>
              ))}
            </div>
          </section>
        )}
        <DetailSection title="分析思路" content={item.analysis} />
        <DetailSection title="参考答案" content={item.answer} />

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">我的备注</h3>
            <button
              type="button"
              onClick={() => onUpdate({ userNote: note })}
              className="min-h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              保存备注
            </button>
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="记录这道题为什么错、下次注意什么"
            className="mt-2 min-h-24 text-sm"
          />
        </section>

        <div className="mt-6 flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() =>
              onUpdate({ status: item.status === 'resolved' ? 'unresolved' : 'resolved' })
            }
            className="tap-target flex flex-1 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground"
          >
            {item.status === 'resolved' ? '标为未掌握' : '标为已掌握'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="tap-target flex h-11 w-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
            aria-label="删除错题"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, content }: { title: string; content: string }) {
  if (!content.trim()) return null;

  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="markdown-body mt-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-6">
        <Markdown remarkPlugins={remarkPlugins}>{formatOcrContentForDisplay(content)}</Markdown>
      </div>
    </section>
  );
}

function Badge({ children, subtle = false }: { children: ReactNode; subtle?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        subtle ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
      }`}
    >
      {children}
    </span>
  );
}
