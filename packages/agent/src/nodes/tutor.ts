export type TutorIntent =
  | 'explain_solution'
  | 'socratic_hint'
  | 'step_check'
  | 'concept_bridge'
  | 'answer_direct'
  | 'general_follow_up';

export type TutorDepth = 'brief' | 'standard' | 'deep';

export type TutorAnswerSection =
  | 'known_conditions'
  | 'concept'
  | 'reasoning_steps'
  | 'common_mistake'
  | 'final_answer'
  | 'guiding_question';

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

type IntentRule = {
  intent: TutorIntent;
  signals: string[];
  reason: string;
};

const intentRules: IntentRule[] = [
  {
    intent: 'answer_direct',
    signals: [
      'only answer',
      'answer only',
      'just give me',
      'final answer',
      'what is the answer',
      "what's the answer",
      '直接给答案',
      '直接给我答案',
      '只要答案',
      '答案是什么',
      '最后答案是什么',
    ],
    reason: 'User explicitly asks for a direct answer.',
  },
  {
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
  {
    intent: 'concept_bridge',
    signals: ['what is', 'formula', 'theorem', 'concept', '公式', '定理', '概念', '是什么'],
    reason: 'User asks for the concept or theorem behind the problem.',
  },
  {
    intent: 'socratic_hint',
    signals: ['why', 'hint', 'how should i think', '思路', '提示', '为什么', '为什么可以'],
    reason: 'User asks for reasoning guidance rather than only the final answer.',
  },
  {
    intent: 'explain_solution',
    signals: ['how to solve', 'solve', 'explain', '讲一下', '解析', '怎么做'],
    reason: 'User asks for a full solution explanation.',
  },
];

const weakStepSignals = new Set(['this step', '这一步']);

export function buildTutorStrategy(input: BuildTutorStrategyInput): TutorStrategy {
  const text = normalizeText(input.latestUserText);
  const match = findIntent(text);
  const hasActiveStudyContext = Boolean(input.activeStudyContext?.trim());
  const intent = match.intent;
  const depth = selectDepth(intent, hasActiveStudyContext);
  const answerStructure = selectAnswerStructure(intent, hasActiveStudyContext);

  return {
    intent,
    depth,
    shouldAskGuidingQuestion: intent === 'socratic_hint' || intent === 'step_check',
    shouldGiveFinalAnswer: intent === 'answer_direct' || intent === 'explain_solution',
    shouldUseActiveStudyContext: hasActiveStudyContext,
    answerStructure,
    promptAddition: buildTutorPrompt({
      intent,
      depth,
      answerStructure,
      hasActiveStudyContext,
    }),
    debug: {
      reason: match.reason,
      matchedSignals: match.matchedSignals,
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
  for (const rule of intentRules) {
    const matchedSignals = rule.signals.filter((signal) => {
      if (
        rule.intent === 'step_check' &&
        weakStepSignals.has(signal) &&
        hasSocraticSignal(text)
      ) {
        return false;
      }

      return matchesSignal(text, signal);
    });

    if (matchedSignals.length > 0) {
      return {
        intent: rule.intent,
        matchedSignals,
        reason: rule.reason,
      };
    }
  }

  return {
    intent: 'general_follow_up',
    matchedSignals: [],
    reason: 'No strong tutoring intent signal was matched.',
  };
}

function hasSocraticSignal(text: string) {
  const rule = intentRules.find((intentRule) => intentRule.intent === 'socratic_hint');
  return Boolean(rule?.signals.some((signal) => matchesSignal(text, signal)));
}

function matchesSignal(text: string, signal: string) {
  const normalizedSignal = signal.toLowerCase();

  if (!isAsciiSignal(normalizedSignal)) {
    return text.includes(normalizedSignal);
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedSignal)}($|[^a-z0-9])`).test(
    text,
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
  if (intent === 'explain_solution' && hasActiveStudyContext) return 'deep';
  return 'standard';
}

function selectAnswerStructure(
  intent: TutorIntent,
  hasActiveStudyContext: boolean,
): TutorAnswerSection[] {
  if (intent === 'answer_direct') {
    return ['final_answer', 'reasoning_steps'];
  }

  if (intent === 'step_check') {
    return ['known_conditions', 'reasoning_steps', 'common_mistake', 'guiding_question'];
  }

  if (intent === 'concept_bridge') {
    return ['known_conditions', 'concept', 'reasoning_steps', 'guiding_question'];
  }

  if (intent === 'socratic_hint') {
    return ['known_conditions', 'concept', 'reasoning_steps', 'guiding_question'];
  }

  if (intent === 'explain_solution') {
    return ['known_conditions', 'concept', 'reasoning_steps', 'final_answer'];
  }

  return hasActiveStudyContext
    ? ['known_conditions', 'reasoning_steps', 'guiding_question']
    : ['concept', 'reasoning_steps'];
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
