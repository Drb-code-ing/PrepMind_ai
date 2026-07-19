import { REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE } from './review-planner-controlled-live-eval-v10-semantic-quality.evidence';

describe('Review Planner controlled Live V10 semantic quality evidence', () => {
  it('owns a separate immutable evidence namespace', () => {
    expect(
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory,
    ).toBe(
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v10-semantic-quality',
    );
    expect(
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.onceLockLeaf,
    ).toBe('.review-planner-controlled-live-v10-semantic-quality.once');
  });
});
