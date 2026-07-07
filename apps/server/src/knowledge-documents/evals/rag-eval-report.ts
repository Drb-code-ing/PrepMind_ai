import type { RagEvalSummary } from './rag-eval.types';

export type RagEvalSmokeCaseHitSummary = {
  hitCount: number;
  topScore?: number;
  topDocumentName?: string;
};

export type FormatRagEvalSmokeReportInput = {
  title: string;
  baseUrl: string;
  documentName: string;
  documentId: string;
  durationMs: number;
  caseHits: Record<string, RagEvalSmokeCaseHitSummary>;
  summary: RagEvalSummary;
};

export function formatRagEvalSmokeReport(input: FormatRagEvalSmokeReportInput) {
  const lines = [
    input.title,
    '',
    `Status: ${input.summary.failed === 0 ? 'PASS' : 'FAIL'}`,
    `Base URL: ${input.baseUrl}`,
    `Document: ${input.documentName} (${input.documentId})`,
    `Duration: ${input.durationMs}ms`,
    '',
    'Metrics',
    `- Passed: ${input.summary.passed}/${input.summary.total}`,
    `- Recall@K: ${formatPercent(input.summary.recallAtK)}`,
    `- Top1 Accuracy: ${formatPercent(input.summary.top1Accuracy)}`,
    `- Safety Pass Rate: ${formatPercent(input.summary.safetyPassRate)}`,
    `- No-hit Pass Rate: ${formatPercent(input.summary.noHitPassRate)}`,
    '',
    'Case Hits',
    ...input.summary.results.map((result) =>
      formatCaseHit(input.caseHits, result.caseId),
    ),
  ];

  const failedResults = input.summary.results.filter(
    (result) => !result.passed,
  );
  if (failedResults.length > 0) {
    lines.push('', 'Failed Cases');
    for (const result of failedResults) {
      lines.push(`- ${result.caseId} (${result.name})`);
      for (const reason of result.reasons) {
        lines.push(`  - ${reason}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatCaseHit(
  caseHits: Record<string, RagEvalSmokeCaseHitSummary>,
  caseId: string,
) {
  const hit = caseHits[caseId] ?? { hitCount: 0 };
  const score = hit.topScore === undefined ? 'n/a' : hit.topScore.toFixed(6);
  const document = hit.topDocumentName ?? 'n/a';
  return `- ${caseId}: hits=${hit.hitCount} topScore=${score} topDocument=${document}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
