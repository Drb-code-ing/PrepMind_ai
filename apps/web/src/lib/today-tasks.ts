export type TodayTaskKind = 'review' | 'wrong-question' | 'capture' | 'summary';

export interface TodayTaskTemplate {
  id: string;
  kind: TodayTaskKind;
  title: string;
  description: string;
  estimateMinutes: number;
  actionLabel: string;
  href: string;
}

export interface TodayTaskState {
  date: string;
  completedTaskIds: string[];
  updatedAt: number;
}

export interface TodayNextAction {
  title: string;
  description: string;
  href: string;
}

export interface TodayTaskToggleFeedback {
  message: string;
  tone: 'success' | 'neutral';
}

export const TODAY_TASKS: TodayTaskTemplate[] = [
  {
    id: 'knowledge-review',
    kind: 'review',
    title: '复盘薄弱知识点',
    description: '花 20 分钟回顾一个最近最容易卡住的知识点。',
    estimateMinutes: 20,
    actionLabel: '找 AI 梳理',
    href: '/chat',
  },
  {
    id: 'wrong-question-review',
    kind: 'wrong-question',
    title: '错题回看',
    description: '优先复习未掌握错题，记录这次卡住的原因。',
    estimateMinutes: 15,
    actionLabel: '打开错题本',
    href: '/error-book',
  },
  {
    id: 'capture-new-question',
    kind: 'capture',
    title: '拍照识题',
    description: '新增识别 1 道题，把有价值的题保存到错题本。',
    estimateMinutes: 10,
    actionLabel: '去识题',
    href: '/chat',
  },
  {
    id: 'daily-summary',
    kind: 'summary',
    title: '学习总结',
    description: '用 3 句话总结今天的薄弱点和明天优先级。',
    estimateMinutes: 5,
    actionLabel: '让 AI 总结',
    href: '/chat',
  },
];

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayStorageKey(userId: string, dateKey: string) {
  return `prepmind-today:${userId}:${dateKey}`;
}

export function createEmptyTodayState(dateKey: string): TodayTaskState {
  return {
    date: dateKey,
    completedTaskIds: [],
    updatedAt: Date.now(),
  };
}

export function toggleTaskCompletion(state: TodayTaskState, taskId: string): TodayTaskState {
  const exists = state.completedTaskIds.includes(taskId);
  return {
    ...state,
    completedTaskIds: exists
      ? state.completedTaskIds.filter((id) => id !== taskId)
      : [...state.completedTaskIds, taskId],
    updatedAt: Date.now(),
  };
}

export function getTodayProgress(state: TodayTaskState) {
  const total = TODAY_TASKS.length;
  const completed = TODAY_TASKS.filter((task) => state.completedTaskIds.includes(task.id)).length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function getTodayTaskToggleFeedback(completed: boolean): TodayTaskToggleFeedback {
  return completed
    ? {
        message: '任务已完成',
        tone: 'success',
      }
    : {
        message: '已取消完成',
        tone: 'neutral',
      };
}

export function getTodayNextAction(
  state: TodayTaskState,
  unresolvedCount: number,
): TodayNextAction {
  if (unresolvedCount > 0 && !state.completedTaskIds.includes('wrong-question-review')) {
    return {
      title: '先复习未掌握错题',
      description: `当前还有 ${unresolvedCount} 道未掌握错题，建议先回看错因和备注。`,
      href: '/error-book',
    };
  }

  const nextTask = TODAY_TASKS.find((task) => !state.completedTaskIds.includes(task.id));
  if (nextTask) {
    return {
      title: nextTask.title,
      description: nextTask.description,
      href: nextTask.href,
    };
  }

  return {
    title: '今天的学习闭环已完成',
    description: '可以回到 AI 对话，让 PrepMind 帮你总结明天的优先级。',
    href: '/chat',
  };
}

export function readTodayTaskState(userId: string, dateKey: string): TodayTaskState {
  if (typeof window === 'undefined') return createEmptyTodayState(dateKey);

  try {
    const raw = window.localStorage.getItem(getTodayStorageKey(userId, dateKey));
    if (!raw) return createEmptyTodayState(dateKey);

    const parsed = JSON.parse(raw) as Partial<TodayTaskState>;
    if (parsed.date !== dateKey || !Array.isArray(parsed.completedTaskIds)) {
      return createEmptyTodayState(dateKey);
    }

    return {
      date: dateKey,
      completedTaskIds: parsed.completedTaskIds.filter(
        (taskId): taskId is string => typeof taskId === 'string',
      ),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return createEmptyTodayState(dateKey);
  }
}

export function writeTodayTaskState(userId: string, state: TodayTaskState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getTodayStorageKey(userId, state.date), JSON.stringify(state));
}
