export type ReviewReminderPreference = {
  inAppEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type ReviewReminderTask = {
  status: string;
  dueAt: string | Date;
};

export type ReviewReminderSummary = {
  todayDueCount: number;
  overdueCount: number;
  nextDueLabel: string;
  pendingSyncCount: number;
};

export function getReviewReminderPreferenceKey(userId: string) {
  return `prepmind-review-reminder:${userId}`;
}

export function getDefaultReviewReminderPreference(): ReviewReminderPreference {
  return {
    inAppEnabled: true,
    quietHoursStart: '22:30',
    quietHoursEnd: '07:30',
  };
}

export function readReviewReminderPreference(raw: string | null): ReviewReminderPreference {
  const defaults = getDefaultReviewReminderPreference();

  if (!raw) {
    return defaults;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaults;
    }

    const preference = parsed as Partial<Record<keyof ReviewReminderPreference, unknown>>;

    return {
      inAppEnabled:
        typeof preference.inAppEnabled === 'boolean'
          ? preference.inAppEnabled
          : defaults.inAppEnabled,
      quietHoursStart:
        typeof preference.quietHoursStart === 'string'
          ? preference.quietHoursStart
          : defaults.quietHoursStart,
      quietHoursEnd:
        typeof preference.quietHoursEnd === 'string'
          ? preference.quietHoursEnd
          : defaults.quietHoursEnd,
    };
  } catch {
    return defaults;
  }
}

export function buildReviewReminderSummary({
  tasks,
  pendingCount,
  pendingSyncCount,
  now = new Date(),
}: {
  tasks: readonly ReviewReminderTask[];
  pendingCount: number;
  pendingSyncCount: number;
  now?: Date;
}): ReviewReminderSummary {
  const nowTime = now.getTime();
  const pendingTasks = tasks.filter((task) => task.status === 'PENDING');
  const overdueCount = pendingTasks.filter((task) => new Date(task.dueAt).getTime() < nowTime).length;
  const nextDueTask = pendingTasks
    .filter((task) => new Date(task.dueAt).getTime() >= nowTime)
    .sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime())[0];

  return {
    todayDueCount: pendingCount,
    overdueCount,
    nextDueLabel: nextDueTask ? formatReviewReminderTime(nextDueTask.dueAt) : '暂无',
    pendingSyncCount,
  };
}

function formatReviewReminderTime(dueAt: string | Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(dueAt));
}
