import type { RagEvalCase } from './rag-eval.types';

export const RAG_EVAL_SMOKE_CASE_IDS = [
  'exact-blue-lantern',
  'semantic-review-pressure',
  'cross-language-weak-points',
] as const;

type RagEvalSmokeCaseId = (typeof RAG_EVAL_SMOKE_CASE_IDS)[number];

type RagEvalSmokeEnv = {
  RAG_EVAL_SMOKE_KEEP_DATA?: string;
};

type RagEvalCaseWithSmokeId = RagEvalCase & {
  id: RagEvalSmokeCaseId;
};

export function selectRagEvalSmokeCases(
  cases: RagEvalCase[],
): RagEvalCaseWithSmokeId[] {
  const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const selected = RAG_EVAL_SMOKE_CASE_IDS.map((caseId) =>
    casesById.get(caseId),
  );
  const missingIds = RAG_EVAL_SMOKE_CASE_IDS.filter(
    (_caseId, index) => !selected[index],
  );

  if (missingIds.length > 0) {
    throw new Error(
      `RAG eval smoke cases are missing required ids: ${missingIds.join(', ')}`,
    );
  }

  return selected as RagEvalCaseWithSmokeId[];
}

export function shouldKeepRagEvalSmokeData(env: RagEvalSmokeEnv) {
  const value = env.RAG_EVAL_SMOKE_KEEP_DATA?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}
