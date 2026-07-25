import {
  tutorBoundedIntentPolicy,
  type TutorBoundedAnswerSection,
  type TutorBoundedDepth,
  type TutorBoundedIntent,
} from '../policies/tutor-strategy-policy.ts';

export type TutorIntent = TutorBoundedIntent | 'answer_direct';
export type TutorDepth = TutorBoundedDepth;
export type TutorAnswerSection = TutorBoundedAnswerSection;

export type TutorStrategy = {
  intent: TutorIntent;
  depth: TutorDepth;
  shouldAskGuidingQuestion: boolean;
  shouldGiveFinalAnswer: boolean;
  shouldUseActiveStudyContext: boolean;
  answerStructure: TutorAnswerSection[];
  promptAddition: string;
  debug: {
    reason: string;
    matchedSignals: string[];
  };
};

export type BuildTutorStrategyInput = {
  latestUserText: string;
  activeStudyContext?: string;
};

export type TutorIntentSignalMatch = Readonly<{
  intent: TutorIntent;
  matchedSignals: readonly string[];
  reason: string;
}>;

export type TutorSignalDetection = Readonly<{
  normalizedText: string;
  selected: TutorIntentSignalMatch;
  intentMatches: readonly TutorIntentSignalMatch[];
}>;

export type BuildTutorStrategyFromIntentInput = Readonly<{
  intent: TutorIntent;
  depth: TutorDepth;
  hasActiveStudyContext: boolean;
  debug: Readonly<{
    reason: string;
    matchedSignals: readonly string[];
  }>;
}>;

type IntentRule = Readonly<{
  intent: TutorIntent;
  signals: readonly string[];
  reason: string;
}>;

const answerDirectRule: IntentRule = Object.freeze({
  intent: 'answer_direct',
  signals: Object.freeze([
    'only answer',
    'answer only',
    'just give me the answer',
    'just give me the result',
    'just give me result',
    'final answer',
    'what is the answer',
    "what's the answer",
    '直接给答案',
    '直接给我答案',
    '只要答案',
    '答案是什么',
    '最后答案是什么',
  ]),
  reason: 'User explicitly asks for a direct answer.',
});

const boundedIntentRules = {
  step_check: {
    intent: 'step_check',
    signals: [
      'is it correct',
      'am i right',
      'check my',
      'check this step',
      'check my work',
      'this step',
      '哪里错',
      '对吗',
      '这一步',
    ],
    reason: 'User asks to verify a submitted step.',
  },
  explain_solution: {
    intent: 'explain_solution',
    signals: ['how to solve', 'solve', 'explain', '讲一下', '解析', '解释', '怎么做'],
    reason: 'User asks for a full solution explanation.',
  },
  concept_bridge: {
    intent: 'concept_bridge',
    signals: ['what is', 'formula', 'theorem', 'concept', '公式', '定理', '概念', '是什么'],
    reason: 'User asks for the concept or theorem behind the problem.',
  },
  socratic_hint: {
    intent: 'socratic_hint',
    signals: ['why', 'hint', 'how should i think', '思路', '提示', '为什么', '为什么可以'],
    reason: 'User asks for reasoning guidance rather than only the final answer.',
  },
  general_follow_up: {
    intent: 'general_follow_up',
    signals: [],
    reason: 'No strong tutoring intent signal was matched.',
  },
} as const satisfies Record<TutorBoundedIntent, IntentRule>;

// This historical deterministic order is a frozen zero-call/baseline authority.
// The governed V4 model precedence is separate and lives in TUTOR_BOUNDED_INTENT_POLICY.
const LOCAL_DETERMINISTIC_INTENT_ORDER = [
  'step_check',
  'concept_bridge',
  'socratic_hint',
  'explain_solution',
  'general_follow_up',
] as const satisfies readonly TutorBoundedIntent[];

const intentRules: readonly IntentRule[] = Object.freeze([
  answerDirectRule,
  ...LOCAL_DETERMINISTIC_INTENT_ORDER.map((intent) => boundedIntentRules[intent]),
]);

const weakStepSignals = new Set(['this step', '这一步']);

export function buildTutorStrategy(input: BuildTutorStrategyInput): TutorStrategy {
  const match = findIntent(input.latestUserText);
  const hasActiveStudyContext = Boolean(input.activeStudyContext?.trim());
  const intent = match.intent;
  const depth = selectDepth(intent, hasActiveStudyContext);

  return buildTutorStrategyFromIntent({
    intent,
    depth,
    hasActiveStudyContext,
    debug: {
      reason: match.reason,
      matchedSignals: match.matchedSignals,
    },
  });
}

export function buildTutorStrategyFromIntent(
  input: BuildTutorStrategyFromIntentInput,
): TutorStrategy {
  const invariants = selectLocalStrategyInvariants(input.intent, input.hasActiveStudyContext);
  const answerStructure = [...invariants.answerStructure];

  return {
    intent: input.intent,
    depth: input.depth,
    shouldAskGuidingQuestion: invariants.shouldAskGuidingQuestion,
    shouldGiveFinalAnswer: invariants.shouldGiveFinalAnswer,
    shouldUseActiveStudyContext: input.hasActiveStudyContext,
    answerStructure,
    promptAddition: buildTutorPrompt({
      intent: input.intent,
      depth: input.depth,
      answerStructure,
      hasActiveStudyContext: input.hasActiveStudyContext,
    }),
    debug: {
      reason: input.debug.reason,
      matchedSignals: [...input.debug.matchedSignals],
    },
  };
}

function normalizeText(text: string) {
  return text.trim().toLowerCase();
}

function findIntent(text: string): {
  intent: TutorIntent;
  matchedSignals: string[];
  reason: string;
} {
  const detection = detectTutorSignals(text);
  return {
    intent: detection.selected.intent,
    matchedSignals: [...detection.selected.matchedSignals],
    reason: detection.selected.reason,
  };
}

export function detectTutorSignals(latestUserText: string): TutorSignalDetection {
  const text = normalizeText(latestUserText);
  const intentMatches: TutorIntentSignalMatch[] = [];

  for (const rule of intentRules) {
    const matchedSignals = rule.signals.filter((signal) => {
      if (rule.intent === 'step_check' && weakStepSignals.has(signal) && hasGuidanceSignal(text)) {
        return false;
      }

      if (matchesSignal(text, signal) && isNegatedIntentSignal(text, signal)) {
        return false;
      }

      return matchesSignal(text, signal);
    });

    if (matchedSignals.length > 0) {
      intentMatches.push({
        intent: rule.intent,
        matchedSignals,
        reason: rule.reason,
      });
    }
  }

  const normalizedMatches = suppressBroadExplanationMatch(intentMatches);
  const selected = normalizedMatches[0] ?? {
    intent: 'general_follow_up',
    matchedSignals: [],
    reason: 'No strong tutoring intent signal was matched.',
  };

  return {
    normalizedText: text,
    selected,
    intentMatches: normalizedMatches,
  };
}

function hasGuidanceSignal(text: string) {
  return hasIntentSignal(text, 'socratic_hint') || hasIntentSignal(text, 'explain_solution');
}

function hasIntentSignal(text: string, intent: TutorIntent) {
  const rule = intentRules.find((intentRule) => intentRule.intent === intent);
  return Boolean(rule?.signals.some((signal) => matchesSignal(text, signal)));
}

function matchesSignal(text: string, signal: string) {
  const normalizedSignal = signal.toLowerCase();

  if (!isAsciiSignal(normalizedSignal)) {
    return text.includes(normalizedSignal);
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedSignal)}($|[^a-z0-9])`).test(text);
}

function isNegatedIntentSignal(text: string, signal: string) {
  const normalizedSignal = signal.toLowerCase();
  let searchFrom = 0;
  let sawOccurrence = false;

  while (searchFrom < text.length) {
    const index = text.indexOf(normalizedSignal, searchFrom);
    if (index < 0) return sawOccurrence;
    sawOccurrence = true;
    const prefix = text.slice(Math.max(0, index - 48), index);
    const negated =
      /(?:不要|别|不必|无需|避免)\s*$/u.test(prefix) ||
      /(?:不要|别|不必|无需|避免)[^，。！？；;]{0,24}$/u.test(prefix) ||
      /(?:do not|don't|dont|without|rather than)[^,.!?;]{0,32}$/iu.test(prefix) ||
      /(?:\bnot)\s*$/iu.test(prefix);
    if (!negated) return false;
    searchFrom = index + normalizedSignal.length;
  }

  return sawOccurrence;
}

function suppressBroadExplanationMatch(
  matches: readonly TutorIntentSignalMatch[],
): TutorIntentSignalMatch[] {
  const conceptMatch = matches.find((match) => match.intent === 'concept_bridge');
  if (conceptMatch === undefined) return [...matches];

  return matches.filter(
    (match) =>
      match.intent !== 'explain_solution' ||
      match.matchedSignals.some((signal) => signal !== 'explain' && signal !== '解释'),
  );
}

function isAsciiSignal(signal: string) {
  return /^[\x00-\x7F]+$/.test(signal);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectDepth(intent: TutorIntent, hasActiveStudyContext: boolean): TutorDepth {
  if (intent === 'answer_direct') return 'brief';
  const policy = tutorBoundedIntentPolicy(intent);
  if (policy === undefined) return 'standard';
  return hasActiveStudyContext
    ? policy.localStrategy.activeContextDepth
    : policy.localStrategy.defaultDepth;
}

function selectLocalStrategyInvariants(
  intent: TutorIntent,
  hasActiveStudyContext: boolean,
): Readonly<{
  shouldAskGuidingQuestion: boolean;
  shouldGiveFinalAnswer: boolean;
  answerStructure: readonly TutorAnswerSection[];
}> {
  if (intent === 'answer_direct') {
    return {
      shouldAskGuidingQuestion: false,
      shouldGiveFinalAnswer: true,
      answerStructure: ['final_answer', 'reasoning_steps'],
    };
  }

  const policy = tutorBoundedIntentPolicy(intent);
  if (policy === undefined) {
    return {
      shouldAskGuidingQuestion: false,
      shouldGiveFinalAnswer: false,
      answerStructure: ['concept', 'reasoning_steps'],
    };
  }
  return {
    shouldAskGuidingQuestion: policy.localStrategy.shouldAskGuidingQuestion,
    shouldGiveFinalAnswer: policy.localStrategy.shouldGiveFinalAnswer,
    answerStructure: hasActiveStudyContext
      ? policy.localStrategy.activeContextAnswerStructure
      : policy.localStrategy.answerStructure,
  };
}

function buildTutorPrompt(input: {
  intent: TutorIntent;
  depth: TutorDepth;
  answerStructure: TutorAnswerSection[];
  hasActiveStudyContext: boolean;
}) {
  return [
    `TutorAgent strategy: ${input.intent}`,
    `TutorAgent depth: ${input.depth}`,
    `Answer structure: ${input.answerStructure.join(' -> ')}`,
    input.hasActiveStudyContext
      ? 'Start from the active OCR question context when it is relevant.'
      : 'No active OCR question context is available; use the latest user message and recent conversation.',
    ...buildIntentInstructions(input.intent),
    'Answer in Chinese unless the user explicitly asks for another language.',
    'Use readable Markdown. Keep formulas in $...$ or $$...$$ form.',
  ].join('\n');
}

function buildIntentInstructions(intent: TutorIntent) {
  if (intent === 'answer_direct') {
    return [
      'Give the final answer first.',
      'Add concise reasoning after the answer.',
      'Do not end with a Socratic question unless the user asks for guidance.',
    ];
  }

  if (intent === 'step_check') {
    return [
      'judge the submitted step first.',
      'If the step is wrong, identify the exact issue before giving the correction.',
      'Avoid rewriting the entire solution unless the missing context makes that necessary.',
    ];
  }

  if (intent === 'concept_bridge') {
    return [
      'Explain the concept, theorem, or formula in exam-oriented language.',
      'connect the concept back to the active problem.',
      'Use a small example only when it reduces confusion.',
    ];
  }

  if (intent === 'socratic_hint') {
    return [
      'Do not dump the full final answer immediately.',
      'Explain the key basis behind the step.',
      'End with one guiding question that helps the user continue.',
    ];
  }

  if (intent === 'explain_solution') {
    return [
      'Restate the known conditions before solving.',
      'Explain the key method before calculations.',
      'Split reasoning into separate readable steps and include the final answer.',
    ];
  }

  return [
    'Answer normally as a tutor.',
    'Use the active study context when it helps the current question.',
    'Keep the answer structured and concise.',
  ];
}

export function buildGenericTutorPrompt() {
  return [
    'TutorAgent generic fallback.',
    'Answer in Chinese unless the user explicitly asks for another language.',
    'Clarify known conditions, explain the key idea, and keep reasoning steps readable.',
  ].join('\n');
}
