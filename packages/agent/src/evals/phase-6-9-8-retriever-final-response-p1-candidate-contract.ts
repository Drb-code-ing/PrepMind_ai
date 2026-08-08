import type {
  Phase698P1FinalResponseManifestEntry,
  Phase698P1RewriteManifestEntry,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';

export type Phase698P1RewriteCandidateInput = Readonly<{
  originalQuery: string;
  recentTurns: readonly Readonly<{ role: 'user' | 'assistant'; content: string }>[];
  activeContext?: Readonly<{ trust: 'untrusted'; question?: string; goal?: string }>;
}>;

export type Phase698P1FinalResponseCandidateInput = Readonly<{
  latestUserMessage: string;
  recentConversation: readonly Readonly<{ role: 'user' | 'assistant'; content: string }>[];
}>;

export function projectP1RewriteCandidateInput(
  entry: Phase698P1RewriteManifestEntry,
): Phase698P1RewriteCandidateInput {
  return deepFreeze({
    originalQuery: entry.originalQuery,
    recentTurns: entry.recentTurns.map((turn) => ({ ...turn })),
    ...(entry.activeContext === undefined ? {} : { activeContext: { ...entry.activeContext } }),
  });
}

export function projectP1FinalResponseCandidateInput(
  entry: Phase698P1FinalResponseManifestEntry,
): Phase698P1FinalResponseCandidateInput {
  return deepFreeze({
    latestUserMessage: entry.latestUserMessage,
    recentConversation: entry.recentConversation.map((turn) => ({ ...turn })),
  });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
