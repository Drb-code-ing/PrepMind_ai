import type { ActiveStudyContext } from './chat-context.ts';

type BuildChatRuntimeRequestBodyInput = {
  requestBody?: object;
  messages: unknown[];
  activeContext: ActiveStudyContext | null;
  accessToken?: string | null;
  conversationId?: string | null;
};

type ChatRuntimeRequestBodyAccessors = {
  getActiveContext: () => ActiveStudyContext | null;
  getAccessToken: () => string | null | undefined;
  getConversationId: () => string | null | undefined;
};

type PrepareChatRuntimeRequestBodyInput = Pick<
  BuildChatRuntimeRequestBodyInput,
  'requestBody' | 'messages'
>;

export function buildChatRuntimeRequestBody(input: BuildChatRuntimeRequestBodyInput) {
  return {
    ...input.requestBody,
    messages: input.messages,
    activeContext: input.activeContext,
    accessToken: input.accessToken ?? null,
    conversationId: input.conversationId ?? null,
  };
}

export function createChatRuntimeRequestBodyPreparer(
  accessors: ChatRuntimeRequestBodyAccessors,
) {
  return (input: PrepareChatRuntimeRequestBodyInput) =>
    buildChatRuntimeRequestBody({
      ...input,
      activeContext: accessors.getActiveContext(),
      accessToken: accessors.getAccessToken(),
      conversationId: accessors.getConversationId(),
    });
}
