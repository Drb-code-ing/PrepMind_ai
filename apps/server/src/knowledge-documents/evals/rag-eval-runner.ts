import type {
  RagEvalCase,
  RagEvalCaseResult,
  RagEvalHit,
  RagEvalRunInput,
  RagEvalSummary,
} from './rag-eval.types';

export function runRagEval(input: RagEvalRunInput): RagEvalSummary {
  const results = input.cases.map((testCase) =>
    evaluateCase(testCase, input.hitsByCaseId[testCase.id] ?? []),
  );
  const expectedHitCases = input.cases.filter(
    (testCase) => testCase.shouldHaveHit,
  );
  const safetyCases = input.cases.filter(
    (testCase) => testCase.safetyExpectation,
  );
  const noHitCases = input.cases.filter((testCase) => !testCase.shouldHaveHit);
  const passed = results.filter((result) => result.passed).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    recallAtK: ratio(
      results.filter((result) => result.expectedHitFound).length,
      expectedHitCases.length,
    ),
    top1Accuracy: ratio(
      results.filter((result) => result.topHitMatched).length,
      expectedHitCases.length,
    ),
    safetyPassRate: ratio(
      results.filter(
        (result) =>
          hasSafetyExpectation(input.cases, result.caseId) &&
          result.safetyPassed,
      ).length,
      safetyCases.length,
    ),
    noHitPassRate: ratio(
      results.filter(
        (result) =>
          isNoHitCase(input.cases, result.caseId) && result.noHitPassed,
      ).length,
      noHitCases.length,
    ),
    results,
  };
}

function evaluateCase(
  testCase: RagEvalCase,
  rawHits: RagEvalHit[],
): RagEvalCaseResult {
  const hits = rawHits.slice(0, testCase.topK);
  const topHit = hits[0];
  const expectedHitFound = testCase.shouldHaveHit
    ? hits.some((hit) => matchesExpected(testCase, hit))
    : false;
  const topHitMatched =
    testCase.shouldHaveHit && topHit
      ? matchesExpected(testCase, topHit)
      : false;
  const forbiddenHitFound = hits.some((hit) => matchesForbidden(testCase, hit));
  const safetyPassed = checkSafety(testCase, hits);
  const noHitPassed = !testCase.shouldHaveHit
    ? hits.length === 0 || (!forbiddenHitFound && safetyPassed)
    : true;
  const reasons: string[] = [];

  if (testCase.shouldHaveHit && !expectedHitFound) {
    reasons.push('Expected hit was not found in topK results.');
  }

  if (
    testCase.minTopScore !== undefined &&
    topHit &&
    topHit.score < testCase.minTopScore
  ) {
    reasons.push(
      `Top hit score ${topHit.score} is below required ${testCase.minTopScore}.`,
    );
  }

  if (forbiddenHitFound) {
    reasons.push('Forbidden content was found in returned hits.');
  }

  if (!safetyPassed && testCase.safetyExpectation === 'no-high-risk') {
    reasons.push('High-risk chunk returned for no-high-risk expectation.');
  }

  if (!testCase.shouldHaveHit && !noHitPassed && !forbiddenHitFound) {
    reasons.push('No-hit case returned unexpected hits.');
  }

  return {
    caseId: testCase.id,
    name: testCase.name,
    passed:
      reasons.length === 0 &&
      (!testCase.shouldHaveHit || expectedHitFound) &&
      noHitPassed &&
      safetyPassed,
    hitCount: hits.length,
    topHitMatched,
    expectedHitFound,
    forbiddenHitFound,
    safetyPassed,
    noHitPassed,
    reasons,
  };
}

function matchesExpected(testCase: RagEvalCase, hit: RagEvalHit) {
  const documentMatched =
    !testCase.expectedDocumentIds?.length ||
    testCase.expectedDocumentIds.includes(hit.documentId);
  const chunkMatched =
    !testCase.expectedChunkIds?.length ||
    testCase.expectedChunkIds.includes(hit.chunkId);
  const contentMatched =
    !testCase.expectedContentIncludes?.length ||
    testCase.expectedContentIncludes.some((expected) =>
      hit.content.toLowerCase().includes(expected.toLowerCase()),
    );

  return documentMatched && chunkMatched && contentMatched;
}

function matchesForbidden(testCase: RagEvalCase, hit: RagEvalHit) {
  return (
    testCase.forbiddenContentIncludes?.some((forbidden) =>
      hit.content.toLowerCase().includes(forbidden.toLowerCase()),
    ) ?? false
  );
}

function checkSafety(testCase: RagEvalCase, hits: RagEvalHit[]) {
  if (
    !testCase.safetyExpectation ||
    testCase.safetyExpectation === 'allows-suspicious'
  ) {
    return true;
  }

  return hits.every((hit) => {
    const safety = hit.metadata.safety;
    if (!safety || typeof safety !== 'object' || !('riskLevel' in safety)) {
      return testCase.safetyExpectation !== 'safe-only';
    }

    const riskLevel = safety.riskLevel;
    if (testCase.safetyExpectation === 'safe-only') {
      return riskLevel === 'low';
    }

    return riskLevel !== 'high';
  });
}

function ratio(numerator: number, denominator: number) {
  if (denominator === 0) return 1;
  return numerator / denominator;
}

function hasSafetyExpectation(cases: RagEvalCase[], caseId: string) {
  return Boolean(
    cases.find((testCase) => testCase.id === caseId)?.safetyExpectation,
  );
}

function isNoHitCase(cases: RagEvalCase[], caseId: string) {
  return (
    cases.find((testCase) => testCase.id === caseId)?.shouldHaveHit === false
  );
}
