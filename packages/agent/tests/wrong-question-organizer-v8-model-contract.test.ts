import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  mergeWrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV5ShortlistAuthority,
} from '@repo/agent/wrong-question-organizer-v6';
import * as OrganizerV8Public from '@repo/agent/wrong-question-organizer-v8';

import {
  WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256,
  WRONG_QUESTION_ORGANIZER_V8_FROZEN_FIXED_SHAPE_CONTRACT_SHA256,
  WRONG_QUESTION_ORGANIZER_V8_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA,
  WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION,
  formatWrongQuestionOrganizerV8ModelPolicyForPrompt,
  validateWrongQuestionOrganizerV8ModelDecision,
  type WrongQuestionOrganizerV8ModelDecision,
} from '../src/model-candidates/wrong-question-organizer-v8-model-contract.ts';
import {
  diagnoseWrongQuestionOrganizerV8Schema,
  WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA,
} from '../src/model-candidates/wrong-question-organizer-v8-schema-diagnostic.ts';
import { deriveWrongQuestionOrganizerV5Shortlist } from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';

describe('Phase 6.9.7 WrongQuestionOrganizer V8 fixed-shape contract', () => {
  test('freezes independent contract and prompt identities behind the public subpath', () => {
    expect(WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION).toBe(
      'wrong-question-organizer-model-candidate-v8',
    );
    expect(WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256).toBe(
      'b21a6dd357ecc19e87869541c7ae6cb52adff130ce32173fd8422ad2f6506545',
    );
    expect(WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_SHA256).toBe(
      '9b85b0a9a310f128d35250e83b3927df8de87f159dac8aac8f412d1189ca6af9',
    );
    expect(WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V8_FROZEN_FIXED_SHAPE_CONTRACT_SHA256,
    );
    expect(WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V8_FROZEN_MODEL_PROMPT_SHA256,
    );
    expect(OrganizerV8Public.validateWrongQuestionOrganizerV8ModelDecision).toBe(
      validateWrongQuestionOrganizerV8ModelDecision,
    );
    const prompt = formatWrongQuestionOrganizerV8ModelPolicyForPrompt();
    expect(prompt).toContain('subjectIndex:null');
    expect(prompt).toContain('JSON numbers, never strings');
    expect(prompt).toContain('exactly questionIndex,subjectIndex,deckAction,targetIndex');
    expect(prompt).not.toContain('pairedRunIndex');
  });

  test('accepts only the fixed four-field decision shape without coercion', () => {
    const decision = canonicalDecision(authorityForTest());
    expect(WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA.safeParse(decision).success).toBe(
      true,
    );
    const variants = [
      {
        ...decision,
        decisions: decision.decisions.map((entry) => ({
          questionIndex: entry.questionIndex,
          subjectDecision: { action: 'keep_local' },
          deckDecision: { action: 'reuse_existing', deckIndex: entry.targetIndex },
        })),
      },
      {
        ...decision,
        decisions: decision.decisions.map((entry) => ({ ...entry, questionIndex: '0' })),
      },
      {
        ...decision,
        decisions: decision.decisions.map((entry) => ({ ...entry, targetIndex: 0.5 })),
      },
      {
        ...decision,
        decisions: decision.decisions.map((entry) => ({ ...entry, explanation: 'extra' })),
      },
      { data: decision },
    ];
    for (const variant of variants) {
      expect(WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA.safeParse(variant).success).toBe(
        false,
      );
    }
  });

  test('maps fixed ordinals through V6 authority and the unchanged local merger', () => {
    const authority = authorityForTest();
    const decision = canonicalDecision(authority);
    const validated = validateWrongQuestionOrganizerV8ModelDecision({ decision, authority });
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(validated.reasonCode);
    expect(validated.value.decisions[0]!.subjectDecision).toEqual({ action: 'keep_local' });
    expect(validated.value.decisions[0]!.deckDecision).toEqual({
      action: 'reuse_existing',
      deckIndex: 0,
    });
    const merged = mergeWrongQuestionOrganizerV6ModelDecision({
      authority,
      decision: validated.value,
      snapshotStable: true,
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) throw new Error(merged.reasonCode);
    expect(merged.value.suggestions[0]!.organization.deckName).toBe('函数极限');
    expect(merged.value.suggestions[0]!.selection.source).toBe('model_ordinal');

    const authorityViolation = validateWrongQuestionOrganizerV8ModelDecision({
      authority,
      decision: {
        ...decision,
        decisions: decision.decisions.map((entry) => ({ ...entry, subjectIndex: 0 })),
      },
    });
    expect(authorityViolation).toEqual({
      ok: false,
      reasonCode: 'subject_authority_violation',
    });
  });
});

describe('Phase 6.9.7 WrongQuestionOrganizer V8 bounded schema diagnostic', () => {
  test('classifies every static reason in deterministic first-failure order', () => {
    const valid = canonicalDecision(authorityForTest());
    const validEntry = valid.decisions[0]!;
    const cases: readonly [unknown, string][] = [
      [null, 'top_level_shape'],
      [{ shortlistFingerprint: valid.shortlistFingerprint }, 'top_level_keys'],
      [{ ...valid, shortlistFingerprint: 7 }, 'fingerprint_type'],
      [{ ...valid, shortlistFingerprint: `sha256:${'A'.repeat(64)}` }, 'fingerprint_format'],
      [{ ...valid, decisions: {} }, 'decisions_type'],
      [{ ...valid, decisions: [] }, 'decisions_count'],
      [{ ...valid, decisions: [null] }, 'decision_shape'],
      [{ ...valid, decisions: [{ ...validEntry, extra: true }] }, 'decision_keys'],
      [{ ...valid, decisions: [{ ...validEntry, questionIndex: '0' }] }, 'question_index'],
      [{ ...valid, decisions: [{ ...validEntry, subjectIndex: '0' }] }, 'subject_index'],
      [{ ...valid, decisions: [{ ...validEntry, deckAction: 'move_existing' }] }, 'deck_action'],
      [{ ...valid, decisions: [{ ...validEntry, targetIndex: -1 }] }, 'target_index'],
    ];
    for (const [input, reason] of cases) {
      const diagnostic = diagnoseWrongQuestionOrganizerV8Schema(input);
      expect(diagnostic?.reason, reason).toBe(reason);
      expect(
        WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.safeParse(diagnostic).success,
        reason,
      ).toBe(true);
      expect(diagnostic?.rawDataRetained, reason).toBe(false);
    }
    expect(diagnoseWrongQuestionOrganizerV8Schema(valid)).toBeNull();
    expect(diagnoseWrongQuestionOrganizerV8Schema(valid, 'dynamic_authority')?.reason).toBe(
      'dynamic_authority',
    );
  });

  test('hashes only bounded shape categories and never retains keys or values', () => {
    const valid = canonicalDecision(authorityForTest());
    const first = diagnoseWrongQuestionOrganizerV8Schema({
      ...valid,
      leakedSecretName: 'sk-sensitive-alpha',
    });
    const second = diagnoseWrongQuestionOrganizerV8Schema({
      ...valid,
      anotherUnknownName: 'Bearer sensitive-beta',
    });
    expect(first?.reason).toBe('top_level_keys');
    expect(first?.shapeFingerprint).toBe(second?.shapeFingerprint);
    const serialized = JSON.stringify(first);
    for (const forbidden of [
      'leakedSecretName',
      'anotherUnknownName',
      'sk-sensitive-alpha',
      'Bearer sensitive-beta',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test('fails hostile accessors and proxies closed to a fixed unknown diagnostic', () => {
    const hostile = {} as Record<string, unknown>;
    Object.defineProperty(hostile, 'shortlistFingerprint', {
      get() {
        throw new Error('sk-hostile-secret');
      },
    });
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('Bearer proxy-secret');
        },
      },
    );
    for (const input of [hostile, proxy]) {
      const diagnostic = diagnoseWrongQuestionOrganizerV8Schema(input);
      expect(diagnostic?.reason).toBe('unknown');
      expect(diagnostic?.rawDataRetained).toBe(false);
      expect(JSON.stringify(diagnostic)).not.toMatch(/hostile|proxy-secret|Bearer|sk-/);
    }
  });
});

function authorityForTest(): WrongQuestionOrganizerV5ShortlistAuthority {
  const result = deriveWrongQuestionOrganizerV5Shortlist({
    ownerDomain: `hmac-sha256:${'a'.repeat(64)}`,
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: `sha256:${createHash('sha256').update('v8-owner').digest('hex')}`,
    safety: 'safe_for_model',
    questions: [
      {
        id: 'q-v8-limit',
        subject: '数学',
        category: '高等数学',
        knowledgePoints: ['函数极限'],
        errorType: '计算错误',
        questionText: '用等价无穷小计算函数极限。',
        analysis: '识别可替换的等价无穷小。',
        status: 'UNRESOLVED',
        updatedAt: '2026-07-28T08:00:00.000Z',
      },
    ],
    decks: [
      {
        id: 'deck-v8-limit',
        subject: '数学',
        name: '函数极限',
        nameLocked: true,
        keywords: ['极限', '无穷小'],
        updatedAt: '2026-07-28T08:00:00.000Z',
      },
    ],
  });
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function canonicalDecision(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV8ModelDecision {
  return {
    shortlistFingerprint: authority.shortlistFingerprint,
    decisions: [
      {
        questionIndex: 0,
        subjectIndex: null,
        deckAction: 'reuse_existing',
        targetIndex: 0,
      },
    ],
  };
}
