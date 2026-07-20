import { expect, test } from 'bun:test';

import { ReviewPlannerDiagnosticCode } from '@repo/agent/review-planner-diagnostics';

test('exposes ReviewPlanner diagnostics through the narrow public subpath', () => {
  expect(ReviewPlannerDiagnosticCode.PreflightInvalid).toBe('preflight_invalid');
  expect(ReviewPlannerDiagnosticCode.EvidenceIo).toBe('evidence_io');
});
