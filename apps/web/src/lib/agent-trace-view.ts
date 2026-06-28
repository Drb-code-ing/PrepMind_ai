import type { AgentRoute } from '@repo/types/api/agent';
import type {
  AgentTraceMode,
  AgentTraceStatus,
  AgentTraceVerifierStatus,
} from '@repo/types/api/agent-trace';

const routeLabels: Record<AgentRoute, string> = {
  chat: 'Chat',
  tutor: 'Tutor',
  rag_answer: 'RAG',
  wrong_question_organize: 'Organizer',
  review_analysis: 'Review',
  study_plan: 'Planner',
  memory_reflection: 'Memory',
  knowledge_dedup: 'Knowledge',
};

const statusLabels: Record<AgentTraceStatus, string> = {
  completed: '已完成',
  degraded: '已降级',
  failed: '失败',
};

const verifierLabels: Record<AgentTraceVerifierStatus, string> = {
  trusted: '可信',
  suspicious: '可疑',
  conflict: '冲突',
  insufficient: '不足',
  skipped: '跳过',
};

export function getAgentTraceModeLabel(mode: AgentTraceMode) {
  return mode === 'live' ? 'Live' : 'Mock';
}

export function getAgentTraceStatusLabel(status: AgentTraceStatus) {
  return statusLabels[status];
}

export function getAgentTraceRouteLabel(route: AgentRoute | null | undefined) {
  return route ? routeLabels[route] : '未路由';
}

export function getAgentTraceVerifierStatusLabel(
  status: AgentTraceVerifierStatus | undefined,
) {
  return status ? verifierLabels[status] : '未执行';
}

export function formatAgentTraceDuration(durationMs: number | null) {
  if (durationMs === null) return '未知';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}

export function formatAgentTraceCost(value: number) {
  if (value === 0) return '0';
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatAgentTracePricingStatus(pricingKnown: boolean) {
  return pricingKnown ? '已配置单价' : '未配置单价';
}

export function formatAgentTraceDateTime(value: string | null | undefined) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getAgentTraceStatusClassName(status: AgentTraceStatus) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'degraded') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-red-50 text-red-700 ring-red-100';
}

export function getAgentTraceModeClassName(mode: AgentTraceMode) {
  return mode === 'live'
    ? 'bg-[#eef7ff] text-[#315f86] ring-[#cfe5f8]'
    : 'bg-white/75 text-[var(--pm-muted)] ring-[var(--pm-line)]';
}
