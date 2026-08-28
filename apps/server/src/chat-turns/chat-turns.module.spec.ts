import { ChatResponseProcessor } from './chat-response.processor';
import { createChatResponseWorkerProviders } from './chat-turns.module';

describe('ChatTurnsModule worker registration', () => {
  it.each([
    ['api', false],
    ['worker', true],
    ['both', true],
  ] as const)(
    'registers the response processor for %s=%s',
    (role, expected) => {
      const providers = createChatResponseWorkerProviders(role);

      expect(providers.includes(ChatResponseProcessor)).toBe(expected);
    },
  );
});
