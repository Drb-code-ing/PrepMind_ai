import type { ActiveStudyContext } from './chat-context.ts';

type BuildChatRuntimeRequestBodyInput = {
  requestBody?: Record<string, unknown>;
  messages: unknown[];
  activeContext: ActiveStudyContext | null;
  accessToken?: string | null;
};

export function buildChatRuntimeRequestBody(input: BuildChatRuntimeRequestBodyInput) {
  return {
    ...input.requestBody,
    messages: input.messages,
    activeContext: input.activeContext,
    accessToken: input.accessToken ?? null,
  };
}
