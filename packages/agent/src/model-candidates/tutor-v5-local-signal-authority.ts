import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  TUTOR_BOUNDED_DEPTHS,
  TUTOR_BOUNDED_EVIDENCE_CODES,
  TUTOR_BOUNDED_INTENTS,
  type TutorBoundedDepth,
  type TutorBoundedEvidenceCode,
  type TutorBoundedIntent,
} from '../policies/tutor-strategy-policy.ts';
import {
  clonePlainModelData,
  deepFreezeModelValue,
  scanCompleteModelField,
  type ModelProjectionSafetyReasonCode,
} from './model-projection-safety.ts';

export const TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION = 'tutor-local-signal-authority-v1' as const;
export const TUTOR_V5_LOCAL_SIGNAL_RULES_VERSION = 'tutor-local-signal-rules-v1' as const;

export const TUTOR_V5_LOCAL_INTENT_PRECEDENCE = deepFreezeModelValue([
  'step_check',
  'explain_solution',
  'concept_bridge',
  'socratic_hint',
  'general_follow_up',
] as const satisfies readonly TutorBoundedIntent[]);

type TutorV5SignalRule = Readonly<{
  intent: Exclude<TutorBoundedIntent, 'general_follow_up'>;
  evidenceCode: Exclude<TutorBoundedEvidenceCode, 'contextual_reference' | 'ambiguous_intent'>;
  compatibleDepths: readonly TutorBoundedDepth[];
  patterns: readonly Readonly<{ id: string; source: string }>[];
}>;

const TUTOR_V5_LOCAL_SIGNAL_RULE_SOURCE = deepFreezeModelValue([
  {
    intent: 'step_check',
    evidenceCode: 'submitted_step',
    compatibleDepths: ['brief', 'standard'],
    patterns: [
      {
        id: 'step_zh_submission',
        source:
          '(?:我(?:把|算|写|得到|推到|代入|合并)|我算出|这一步|这一行|有没有算偏|帮我(?:检查|判断)|偏了吗|对吗)',
      },
      {
        id: 'step_en_submission',
        source:
          '(?:\\bi (?:got|reached|wrote|substituted|combined)\\b|\\bmy (?:step|derivative|substitution)\\b|\\b(?:check|verify|inspect) (?:this|that|my)\\b|\\bam i right\\b|\\bis (?:this|that) correct\\b)',
      },
    ],
  },
  {
    intent: 'explain_solution',
    evidenceCode: 'full_explanation_request',
    compatibleDepths: ['standard', 'deep'],
    patterns: [
      {
        id: 'explain_zh_complete',
        source:
          '(?:完整(?:解释|讲|解法|推导|捋)|不要省略|别省略|从(?:已知|条件).{0,20}(?:结论|结果)|中间环节)',
      },
      {
        id: 'explain_en_complete',
        source:
          '(?:\\bcomplete (?:solution|derivation|explanation|chain)\\b|\\bwhole (?:solution|derivation|analysis)\\b|\\bwalk through\\b|\\bfrom the givens\\b|\\bdo not skip\\b|\\bwithout skipping\\b|\\bexplain the entire\\b)',
      },
    ],
  },
  {
    intent: 'concept_bridge',
    evidenceCode: 'concept_gap',
    compatibleDepths: ['standard', 'deep'],
    patterns: [
      {
        id: 'concept_zh_gap',
        source:
          '(?:不明白.{0,18}(?:为什么|联系|依据|结论)|没串起来|背后(?:联系|原理|依据)?|核心依据|为什么(?:等价|成立|可以)|概念(?:联系|含义)?|定理(?:联系|含义)?|(?:公式|概念|定理).{0,24}(?:联系|含义|为什么))',
      },
      {
        id: 'concept_en_gap',
        source:
          "(?:\\bunderlying (?:idea|principle)\\b|\\bprinciple behind\\b|\\bcannot connect\\b|\\bcan't connect\\b|\\bdon't understand why\\b|\\bwhy .{0,24} (?:works|holds)\\b|\\bconceptual (?:link|meaning)\\b|\\bmeaning of the formula\\b|\\btheorem behind\\b|\\b(?:relationship|connection).{0,16}unclear\\b|\\bstill unclear\\b)",
      },
    ],
  },
  {
    intent: 'socratic_hint',
    evidenceCode: 'implicit_hint_request',
    compatibleDepths: ['brief', 'standard'],
    patterns: [
      {
        id: 'hint_zh_guidance',
        source:
          '(?:我(?:卡住|没跟上)|这里卡住|没接上|先(?:给我)?(?:一点)?提示|给我.{0,6}提示|先问我|别直接(?:说完|讲完|揭晓|给答案)|不要直接(?:说完|讲完|揭晓|给答案)|给我.{0,8}思路)',
      },
      {
        id: 'hint_en_guidance',
        source:
          "(?:\\bi am stuck\\b|\\bi'm stuck\\b|\\bgive (?:me )?(?:one |a )?(?:hint|nudge)\\b|\\bone (?:hint|nudge)\\b|\\bwithout revealing\\b|\\bdo not reveal\\b|\\bdon't reveal\\b|\\blet me (?:work|find)\\b|\\bask me one question\\b)",
      },
    ],
  },
] as const satisfies readonly TutorV5SignalRule[]);

const TUTOR_V5_NEGATION_PREFIX_SOURCES = deepFreezeModelValue([
  '(?:不要|别|不必|无需|避免)[^，。！？；;,.!?]{0,24}$',
  "(?:do not|don't|dont|without|rather than)[^,.!?;]{0,32}$",
  '(?:\\bnot)\\s*$',
] as const);

const TUTOR_V5_QUOTE_PAIRS = deepFreezeModelValue([
  ['“', '”'],
  ['‘', '’'],
  ['「', '」'],
  ['『', '』'],
] as const);

const TUTOR_V5_LOCAL_SIGNAL_RULES_CONTENT = deepFreezeModelValue({
  version: TUTOR_V5_LOCAL_SIGNAL_RULES_VERSION,
  detectorSemantics: {
    intentInput: 'latest_text_only',
    normalization: 'nfkc_trim_lower_collapse_whitespace_v1',
    matchMode: 'unicode_case_insensitive_global_v1',
    negationPrefixSources: TUTOR_V5_NEGATION_PREFIX_SOURCES,
    quotedSignalPolicy: 'ignore_balanced_quote_spans_v1',
    quotePairs: TUTOR_V5_QUOTE_PAIRS,
    asciiDoubleQuotePolicy: 'ignore_when_enclosed_by_double_quotes_v1',
  },
  precedence: TUTOR_V5_LOCAL_INTENT_PRECEDENCE,
  rules: TUTOR_V5_LOCAL_SIGNAL_RULE_SOURCE,
  generalFollowUp: {
    compatibleDepths: ['brief', 'standard'],
    contextualPatterns: [
      '(?:接下来|继续呢|继续分析|那这个.{0,8}呢)',
      "(?:\\bwhat(?: is|’s|'s)? (?:the )?next\\b|\\bcontinue.{0,24}(?:from|with)\\b|\\bwhere we left off\\b)",
    ],
    ambiguousPatterns: [
      '(?:带着我想|引导我想|帮我理一理|我该从哪想)',
      '(?:\\bguide me\\b|\\bhelp me think\\b|\\bwhere should i start\\b)',
    ],
  },
  answerDirectPatterns: [
    '(?:直接给(?:我)?答案|只要答案|答案是什么|最后答案是什么)',
    "(?:\\bjust give me the answer\\b|\\bonly (?:the )?answer\\b|\\banswer only\\b|\\bwhat(?: is|’s|'s) the answer\\b)",
  ],
  explicitLocalOnly: [
    '直接给我答案',
    '先给我一个提示',
    '帮我检查这一步对吗',
    '解释这里的概念',
    '完整讲一下怎么做',
    'just give me the answer',
    'give me one hint',
    'check this step',
    'explain this concept',
    'explain the full solution',
  ],
});

export const TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256 = sha256Canonical(
  TUTOR_V5_LOCAL_SIGNAL_RULES_CONTENT,
);

export const TUTOR_V5_FROZEN_LOCAL_SIGNAL_RULES_SHA256 =
  'a1e9a3b0489e5be5f2c64205128231887cf26b6f151028c2cb8324ddb65f4892' as const;

if (TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256 !== TUTOR_V5_FROZEN_LOCAL_SIGNAL_RULES_SHA256) {
  throw new Error('TUTOR_V5_LOCAL_SIGNAL_RULES_SHA_MISMATCH');
}

export type TutorV5AuthorityReasonCode =
  | 'primary_signal'
  | 'ambiguous_signal'
  | 'contextual_follow_up'
  | 'explicit_instruction_local_only'
  | 'answer_direct_local_only'
  | 'no_model_signal';

export type TutorV5LocalSignalAuthority = Readonly<{
  version: typeof TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION;
  rulesVersion: typeof TUTOR_V5_LOCAL_SIGNAL_RULES_VERSION;
  rulesSha256: string;
  authoritySha256: string;
  provenance: Readonly<{
    detector: 'local_deterministic';
    intentInput: 'latest_text_only';
    contextEffect: 'availability_only';
  }>;
  input: Readonly<{
    normalizedLatestTextSha256: string;
    activeContextAvailable: boolean;
  }>;
  detectedSignals: readonly Readonly<{
    intent: Exclude<TutorBoundedIntent, 'general_follow_up'>;
    evidenceCode: Exclude<TutorBoundedEvidenceCode, 'contextual_reference' | 'ambiguous_intent'>;
    signalIds: readonly string[];
  }>[];
  negatedSignalIds: readonly string[];
  evidenceCodes: readonly TutorBoundedEvidenceCode[];
  primaryIntent: TutorBoundedIntent | null;
  eligibleChoices: readonly Readonly<{
    intent: TutorBoundedIntent;
    depths: readonly TutorBoundedDepth[];
  }>[];
  confidence: 'medium' | 'high';
  reasonCode: TutorV5AuthorityReasonCode;
}>;

export type TutorV5LocalSignalAuthorityFailureCode =
  | ModelProjectionSafetyReasonCode
  | 'unsafe_metadata'
  | 'authority_contract_invalid';

export type TutorV5LocalSignalAuthorityResult =
  | Readonly<{ ok: true; value: TutorV5LocalSignalAuthority }>
  | Readonly<{ ok: false; reasonCode: TutorV5LocalSignalAuthorityFailureCode }>;

const SAFETY_STATE_SCHEMA = z.enum(['safe_for_model', 'unsafe', 'unknown']);
const AUTHORITY_INPUT_SCHEMA = z
  .object({
    latestUserText: z.string(),
    activeStudyContext: z.string().optional(),
    safety: z
      .object({
        latestUserText: SAFETY_STATE_SCHEMA,
        activeStudyContext: SAFETY_STATE_SCHEMA.optional(),
      })
      .strict(),
  })
  .strict();

const ELIGIBLE_CHOICE_SCHEMA = z
  .object({
    intent: z.enum(TUTOR_BOUNDED_INTENTS),
    depths: z.array(z.enum(TUTOR_BOUNDED_DEPTHS)).min(1).max(TUTOR_BOUNDED_DEPTHS.length),
  })
  .strict();

const AUTHORITY_SCHEMA = z
  .object({
    version: z.literal(TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION),
    rulesVersion: z.literal(TUTOR_V5_LOCAL_SIGNAL_RULES_VERSION),
    rulesSha256: z.string().regex(/^[a-f0-9]{64}$/),
    authoritySha256: z.string().regex(/^[a-f0-9]{64}$/),
    provenance: z
      .object({
        detector: z.literal('local_deterministic'),
        intentInput: z.literal('latest_text_only'),
        contextEffect: z.literal('availability_only'),
      })
      .strict(),
    input: z
      .object({
        normalizedLatestTextSha256: z.string().regex(/^[a-f0-9]{64}$/),
        activeContextAvailable: z.boolean(),
      })
      .strict(),
    detectedSignals: z.array(
      z
        .object({
          intent: z.enum(['step_check', 'explain_solution', 'concept_bridge', 'socratic_hint']),
          evidenceCode: z.enum([
            'submitted_step',
            'full_explanation_request',
            'concept_gap',
            'implicit_hint_request',
          ]),
          signalIds: z
            .array(z.string().regex(/^[a-z0-9_]{3,64}$/))
            .min(1)
            .max(8),
        })
        .strict(),
    ),
    negatedSignalIds: z.array(z.string().regex(/^[a-z0-9_]{3,64}$/)).max(16),
    evidenceCodes: z.array(z.enum(TUTOR_BOUNDED_EVIDENCE_CODES)).max(8),
    primaryIntent: z.enum(TUTOR_BOUNDED_INTENTS).nullable(),
    eligibleChoices: z.array(ELIGIBLE_CHOICE_SCHEMA).max(TUTOR_BOUNDED_INTENTS.length),
    confidence: z.enum(['medium', 'high']),
    reasonCode: z.enum([
      'primary_signal',
      'ambiguous_signal',
      'contextual_follow_up',
      'explicit_instruction_local_only',
      'answer_direct_local_only',
      'no_model_signal',
    ]),
  })
  .strict();

export function deriveTutorV5LocalSignalAuthority(
  input: unknown,
): TutorV5LocalSignalAuthorityResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };
    const parsed = AUTHORITY_INPUT_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'invalid_input' };
    const source = parsed.data;
    const hasContext = source.activeStudyContext !== undefined;
    if (hasContext !== (source.safety.activeStudyContext !== undefined)) {
      return { ok: false, reasonCode: 'invalid_input' };
    }
    if (
      source.safety.latestUserText !== 'safe_for_model' ||
      source.safety.activeStudyContext === 'unsafe' ||
      source.safety.activeStudyContext === 'unknown'
    ) {
      return { ok: false, reasonCode: 'unsafe_metadata' };
    }

    const latest = scanCompleteModelField(source.latestUserText, {
      maxUtf16CodeUnits: 16_384,
      rejectToolOrWriteInstruction: true,
    });
    if (!latest.ok) return latest;
    const context = hasContext
      ? scanCompleteModelField(source.activeStudyContext ?? '', {
          maxUtf16CodeUnits: 16_384,
          rejectToolOrWriteInstruction: true,
        })
      : undefined;
    if (context !== undefined && !context.ok) return context;
    if (source.latestUserText.length + (source.activeStudyContext?.length ?? 0) > 24_576) {
      return { ok: false, reasonCode: 'field_too_large' };
    }

    const normalizedText = normalizeText(latest.value);
    const activeContextAvailable = Boolean(context?.ok && context.value.trim());
    const detectedSignals: Array<TutorV5LocalSignalAuthority['detectedSignals'][number]> = [];
    const negatedSignalIds: string[] = [];

    for (const rule of TUTOR_V5_LOCAL_SIGNAL_RULE_SOURCE) {
      const matchedIds: string[] = [];
      for (const pattern of rule.patterns) {
        const result = matchPattern(normalizedText, pattern);
        if (result.positive) matchedIds.push(pattern.id);
        if (result.negated) negatedSignalIds.push(pattern.id);
      }
      if (matchedIds.length > 0) {
        detectedSignals.push({
          intent: rule.intent,
          evidenceCode: rule.evidenceCode,
          signalIds: uniqueSorted(matchedIds),
        });
      }
    }

    detectedSignals.sort(
      (left, right) =>
        TUTOR_V5_LOCAL_INTENT_PRECEDENCE.indexOf(left.intent) -
        TUTOR_V5_LOCAL_INTENT_PRECEDENCE.indexOf(right.intent),
    );
    const answerDirect = hasPositiveAnswerDirectSignal(normalizedText);
    const explicitLocalOnly = isExplicitLocalOnlyInstruction(normalizedText);
    const contextual =
      activeContextAvailable &&
      TUTOR_V5_LOCAL_SIGNAL_RULES_CONTENT.generalFollowUp.contextualPatterns.some((source) =>
        new RegExp(source, 'iu').test(normalizedText),
      );
    const ambiguous = TUTOR_V5_LOCAL_SIGNAL_RULES_CONTENT.generalFollowUp.ambiguousPatterns.some(
      (source) => new RegExp(source, 'iu').test(normalizedText),
    );

    let reasonCode: TutorV5AuthorityReasonCode;
    let primaryIntent: TutorBoundedIntent | null = detectedSignals[0]?.intent ?? null;
    let eligibleChoices = detectedSignals.map((signal) => choiceForIntent(signal.intent));
    const evidenceCodes: TutorBoundedEvidenceCode[] = detectedSignals.map(
      (signal) => signal.evidenceCode,
    );

    if (answerDirect) {
      reasonCode = 'answer_direct_local_only';
      primaryIntent = null;
      eligibleChoices = [];
    } else if (explicitLocalOnly) {
      reasonCode = 'explicit_instruction_local_only';
      primaryIntent = null;
      eligibleChoices = [];
    } else if (primaryIntent !== null) {
      reasonCode = 'primary_signal';
      if (contextual) evidenceCodes.push('contextual_reference');
    } else if (ambiguous) {
      reasonCode = 'ambiguous_signal';
      evidenceCodes.push('ambiguous_intent');
      eligibleChoices = [choiceForIntent('socratic_hint'), choiceForIntent('general_follow_up')];
    } else if (contextual) {
      reasonCode = 'contextual_follow_up';
      evidenceCodes.push('contextual_reference');
      eligibleChoices = [choiceForIntent('general_follow_up')];
    } else {
      reasonCode = 'no_model_signal';
      eligibleChoices = [];
    }

    const withoutHash = {
      version: TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION,
      rulesVersion: TUTOR_V5_LOCAL_SIGNAL_RULES_VERSION,
      rulesSha256: TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
      provenance: {
        detector: 'local_deterministic' as const,
        intentInput: 'latest_text_only' as const,
        contextEffect: 'availability_only' as const,
      },
      input: {
        normalizedLatestTextSha256: sha256(normalizedText),
        activeContextAvailable,
      },
      detectedSignals,
      negatedSignalIds: uniqueSorted(negatedSignalIds),
      evidenceCodes: uniqueEvidenceCodes(evidenceCodes),
      primaryIntent,
      eligibleChoices: uniqueChoices(eligibleChoices),
      confidence:
        primaryIntent !== null && detectedSignals.length === 1
          ? ('high' as const)
          : ('medium' as const),
      reasonCode,
    };
    const authority = deepFreezeModelValue({
      ...withoutHash,
      authoritySha256: sha256Canonical(withoutHash),
    });
    return validateTutorV5LocalSignalAuthority(authority).ok
      ? { ok: true, value: authority }
      : { ok: false, reasonCode: 'authority_contract_invalid' };
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
}

export function validateTutorV5LocalSignalAuthority(
  input: unknown,
): TutorV5LocalSignalAuthorityResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'authority_contract_invalid' };
    const parsed = AUTHORITY_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'authority_contract_invalid' };
    const authority = parsed.data;
    if (
      authority.rulesSha256 !== TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256 ||
      authority.authoritySha256 !==
        sha256Canonical({
          version: authority.version,
          rulesVersion: authority.rulesVersion,
          rulesSha256: authority.rulesSha256,
          provenance: authority.provenance,
          input: authority.input,
          detectedSignals: authority.detectedSignals,
          negatedSignalIds: authority.negatedSignalIds,
          evidenceCodes: authority.evidenceCodes,
          primaryIntent: authority.primaryIntent,
          eligibleChoices: authority.eligibleChoices,
          confidence: authority.confidence,
          reasonCode: authority.reasonCode,
        })
    ) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    if (!hasCanonicalAuthoritySemantics(authority)) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    return { ok: true, value: deepFreezeModelValue(authority) };
  } catch {
    return { ok: false, reasonCode: 'authority_contract_invalid' };
  }
}

function hasCanonicalAuthoritySemantics(authority: z.infer<typeof AUTHORITY_SCHEMA>) {
  if (authority.detectedSignals.length > TUTOR_V5_LOCAL_SIGNAL_RULE_SOURCE.length) return false;
  const detectedIntents = authority.detectedSignals.map((signal) => signal.intent);
  if (new Set(detectedIntents).size !== detectedIntents.length) return false;
  if (
    !sameValues(
      detectedIntents,
      [...detectedIntents].sort(
        (left, right) =>
          TUTOR_V5_LOCAL_INTENT_PRECEDENCE.indexOf(left) -
          TUTOR_V5_LOCAL_INTENT_PRECEDENCE.indexOf(right),
      ),
    )
  ) {
    return false;
  }
  for (const signal of authority.detectedSignals) {
    const rule = TUTOR_V5_LOCAL_SIGNAL_RULE_SOURCE.find((entry) => entry.intent === signal.intent);
    if (
      rule === undefined ||
      signal.evidenceCode !== rule.evidenceCode ||
      new Set(signal.signalIds).size !== signal.signalIds.length ||
      !sameValues(signal.signalIds, [...signal.signalIds].sort(compareCodePoints)) ||
      signal.signalIds.some((id) => !rule.patterns.some((pattern) => pattern.id === id))
    ) {
      return false;
    }
  }
  const knownSignalIds = new Set<string>(
    TUTOR_V5_LOCAL_SIGNAL_RULE_SOURCE.flatMap((rule) => rule.patterns.map((pattern) => pattern.id)),
  );
  if (
    !sameValues(
      authority.negatedSignalIds,
      [...authority.negatedSignalIds].sort(compareCodePoints),
    ) ||
    authority.negatedSignalIds.some((id) => !knownSignalIds.has(id))
  ) {
    return false;
  }
  const choiceIntents = authority.eligibleChoices.map((choice) => choice.intent);
  if (new Set(choiceIntents).size !== choiceIntents.length) return false;
  if (new Set(authority.evidenceCodes).size !== authority.evidenceCodes.length) return false;
  if (new Set(authority.negatedSignalIds).size !== authority.negatedSignalIds.length) return false;
  if (
    !sameValues(
      choiceIntents,
      [...choiceIntents].sort(
        (left, right) =>
          TUTOR_V5_LOCAL_INTENT_PRECEDENCE.indexOf(left) -
          TUTOR_V5_LOCAL_INTENT_PRECEDENCE.indexOf(right),
      ),
    )
  ) {
    return false;
  }
  for (const choice of authority.eligibleChoices) {
    const expected = choiceForIntent(choice.intent).depths;
    if (!sameValues(choice.depths, expected)) return false;
  }
  const detectedEvidenceCodes = authority.detectedSignals.map((signal) => signal.evidenceCode);
  const expectedDetectedEvidence = uniqueEvidenceCodes(detectedEvidenceCodes);
  const evidenceWithoutContext = authority.evidenceCodes.filter(
    (code) => code !== 'contextual_reference',
  );
  if (
    authority.evidenceCodes.includes('contextual_reference') &&
    !authority.input.activeContextAvailable
  ) {
    return false;
  }
  if (
    authority.reasonCode !== 'ambiguous_signal' &&
    !sameValues(evidenceWithoutContext, expectedDetectedEvidence)
  ) {
    return false;
  }
  switch (authority.reasonCode) {
    case 'primary_signal':
      return (
        authority.detectedSignals.length > 0 &&
        authority.primaryIntent === authority.detectedSignals[0]?.intent &&
        sameValues(choiceIntents, detectedIntents) &&
        authority.confidence === (authority.detectedSignals.length === 1 ? 'high' : 'medium') &&
        !authority.evidenceCodes.includes('ambiguous_intent')
      );
    case 'ambiguous_signal':
      return (
        authority.detectedSignals.length === 0 &&
        authority.primaryIntent === null &&
        sameValues(choiceIntents, ['socratic_hint', 'general_follow_up']) &&
        sameValues(authority.evidenceCodes, ['ambiguous_intent']) &&
        authority.confidence === 'medium'
      );
    case 'contextual_follow_up':
      return (
        authority.input.activeContextAvailable &&
        authority.detectedSignals.length === 0 &&
        authority.primaryIntent === null &&
        sameValues(choiceIntents, ['general_follow_up']) &&
        sameValues(authority.evidenceCodes, ['contextual_reference']) &&
        authority.confidence === 'medium'
      );
    case 'answer_direct_local_only':
    case 'explicit_instruction_local_only':
      return (
        authority.primaryIntent === null &&
        authority.eligibleChoices.length === 0 &&
        authority.confidence === 'medium' &&
        !authority.evidenceCodes.includes('ambiguous_intent')
      );
    case 'no_model_signal':
      return (
        authority.detectedSignals.length === 0 &&
        authority.primaryIntent === null &&
        authority.eligibleChoices.length === 0 &&
        authority.evidenceCodes.length === 0 &&
        authority.confidence === 'medium'
      );
  }
}

function choiceForIntent(intent: TutorBoundedIntent) {
  const rule = TUTOR_V5_LOCAL_SIGNAL_RULE_SOURCE.find((entry) => entry.intent === intent);
  return deepFreezeModelValue({
    intent,
    depths:
      rule?.compatibleDepths ??
      (['brief', 'standard'] as const satisfies readonly TutorBoundedDepth[]),
  });
}

function matchPattern(text: string, pattern: Readonly<{ id: string; source: string }>) {
  const expression = new RegExp(pattern.source, 'giu');
  let positive = false;
  let negated = false;
  for (const match of text.matchAll(expression)) {
    const index = match.index ?? 0;
    const end = index + (match[0]?.length ?? 0);
    if (isQuotedMatch(text, index, end)) continue;
    if (isNegatedMatch(text, index)) negated = true;
    else positive = true;
  }
  return { positive, negated };
}

function isNegatedMatch(text: string, index: number) {
  const prefix = text.slice(Math.max(0, index - 48), index);
  return TUTOR_V5_NEGATION_PREFIX_SOURCES.some((source) => new RegExp(source, 'iu').test(prefix));
}

function isQuotedMatch(text: string, start: number, end: number) {
  for (const [open, close] of TUTOR_V5_QUOTE_PAIRS) {
    const lastOpen = text.lastIndexOf(open, start);
    const lastClose = text.lastIndexOf(close, start);
    if (lastOpen > lastClose && text.indexOf(close, end) >= end) return true;
  }
  const precedingDoubleQuotes = text.slice(0, start).split('"').length - 1;
  return precedingDoubleQuotes % 2 === 1 && text.indexOf('"', end) >= end;
}

function hasPositiveAnswerDirectSignal(text: string) {
  return TUTOR_V5_LOCAL_SIGNAL_RULES_CONTENT.answerDirectPatterns.some((source) => {
    const expression = new RegExp(source, 'giu');
    return Array.from(text.matchAll(expression)).some((match) => {
      const start = match.index ?? 0;
      return (
        !isQuotedMatch(text, start, start + (match[0]?.length ?? 0)) && !isNegatedMatch(text, start)
      );
    });
  });
}

function isExplicitLocalOnlyInstruction(text: string) {
  const compact = text.replace(/[\s，。！？!?；;：:、"'“”‘’]+/gu, ' ').trim();
  return TUTOR_V5_LOCAL_SIGNAL_RULES_CONTENT.explicitLocalOnly.some(
    (value) => compact === normalizeText(value),
  );
}

function uniqueChoices(
  choices: readonly Readonly<{
    intent: TutorBoundedIntent;
    depths: readonly TutorBoundedDepth[];
  }>[],
) {
  const byIntent = new Map<TutorBoundedIntent, (typeof choices)[number]>();
  for (const choice of choices) byIntent.set(choice.intent, choice);
  return TUTOR_V5_LOCAL_INTENT_PRECEDENCE.filter((intent) => byIntent.has(intent)).map(
    (intent) => byIntent.get(intent)!,
  );
}

function uniqueEvidenceCodes(values: readonly TutorBoundedEvidenceCode[]) {
  return TUTOR_BOUNDED_EVIDENCE_CODES.filter((value) => values.includes(value));
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort(compareCodePoints);
}

function sameValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Canonical(value: unknown) {
  return sha256(JSON.stringify(sortObjectKeys(value)));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function compareCodePoints(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
