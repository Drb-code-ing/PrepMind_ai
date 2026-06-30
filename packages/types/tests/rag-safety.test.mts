import assert from 'node:assert/strict';
import { describe, it } from 'bun:test';

import {
  ragSafetyClassificationSchema,
  ragSafetyRiskLevelSchema,
} from '../src/api/rag-safety';

describe('rag safety schemas', () => {
  it('accepts a high-risk prompt injection classification', () => {
    const parsed = ragSafetyClassificationSchema.parse({
      riskLevel: 'high',
      categories: ['instruction_override', 'secret_exfiltration'],
      matchedPatterns: ['ignore_previous_instructions'],
      safeForPrompt: false,
    });

    assert.equal(parsed.safeForPrompt, false);
    assert.deepEqual(parsed.categories, [
      'instruction_override',
      'secret_exfiltration',
    ]);
  });

  it('rejects unknown risk levels', () => {
    assert.throws(() => ragSafetyRiskLevelSchema.parse('critical'));
  });
});
