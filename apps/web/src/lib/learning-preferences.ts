export type ExplanationStyle = 'direct' | 'socratic' | 'detailed';
export type DailyIntensity = 'light' | 'standard' | 'intense';

export interface LearningPreferences {
  examGoal: string;
  explanationStyle: ExplanationStyle;
  dailyIntensity: DailyIntensity;
  updatedAt: number;
}

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  examGoal: '高数期末强化',
  explanationStyle: 'direct',
  dailyIntensity: 'standard',
  updatedAt: 0,
};

const explanationStyles = new Set<ExplanationStyle>(['direct', 'socratic', 'detailed']);
const dailyIntensities = new Set<DailyIntensity>(['light', 'standard', 'intense']);

export function createLearningPreferenceStorageKey(userId: string) {
  return `prepmind-preferences:${userId}`;
}

export function normalizeLearningPreferences(value: unknown): LearningPreferences {
  const input =
    value && typeof value === 'object'
      ? (value as Partial<Record<keyof LearningPreferences, unknown>>)
      : {};

  const examGoal =
    typeof input.examGoal === 'string' && input.examGoal.trim()
      ? input.examGoal.trim().slice(0, 80)
      : DEFAULT_LEARNING_PREFERENCES.examGoal;
  const explanationStyle = explanationStyles.has(input.explanationStyle as ExplanationStyle)
    ? (input.explanationStyle as ExplanationStyle)
    : DEFAULT_LEARNING_PREFERENCES.explanationStyle;
  const dailyIntensity = dailyIntensities.has(input.dailyIntensity as DailyIntensity)
    ? (input.dailyIntensity as DailyIntensity)
    : DEFAULT_LEARNING_PREFERENCES.dailyIntensity;
  const updatedAt =
    typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : DEFAULT_LEARNING_PREFERENCES.updatedAt;

  return {
    examGoal,
    explanationStyle,
    dailyIntensity,
    updatedAt,
  };
}

export function readLearningPreferences(userId: string): LearningPreferences {
  if (typeof window === 'undefined' || !userId) return DEFAULT_LEARNING_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(createLearningPreferenceStorageKey(userId));
    if (!raw) return DEFAULT_LEARNING_PREFERENCES;
    return normalizeLearningPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_LEARNING_PREFERENCES;
  }
}

export function writeLearningPreferences(userId: string, preferences: LearningPreferences) {
  if (typeof window === 'undefined' || !userId) return;

  const normalized = normalizeLearningPreferences({
    ...preferences,
    updatedAt: preferences.updatedAt || Date.now(),
  });

  window.localStorage.setItem(
    createLearningPreferenceStorageKey(userId),
    JSON.stringify(normalized),
  );
}
