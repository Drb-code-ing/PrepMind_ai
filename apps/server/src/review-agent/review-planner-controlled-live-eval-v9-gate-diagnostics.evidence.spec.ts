import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';

describe('Phase 6.9.5 V9 gate diagnostics evidence contract', () => {
  it('freezes the isolated V9 profile and ordered diagnostic stages', () => {
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE).toEqual({
      id: 'phase-6.9.5-review-planner-controlled-live-v9-gate-diagnostics',
      evidenceSchemaVersion:
        'phase-6.9.5-review-planner-controlled-live-evidence-v9-gate-diagnostics',
      evidenceDirectory:
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v9-gate-diagnostics',
      onceLockLeaf: '.review-planner-controlled-live-v9-gate-diagnostics.once',
      diagnosticCommitLeaf: '.stage-085-safe-aggregate-committed.json',
      successCommitLeaf:
        '.review-planner-controlled-live-v9-gate-diagnostics.success',
    });
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(0, 10)).toEqual([
      '.stage-010-reserved',
      '.stage-020-attempted',
      '.stage-030-evaluator-ready',
      '.stage-040-provider-history-verified',
      '.stage-050-canary-started',
      '.stage-060-canary-returned',
      '.stage-070-paired-started',
      '.stage-080-paired-returned',
      '.stage-085-safe-aggregate-committed.json',
      '.stage-090-validation-completed',
    ]);
  });
});
