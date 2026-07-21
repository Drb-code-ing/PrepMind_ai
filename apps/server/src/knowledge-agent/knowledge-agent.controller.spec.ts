import { EventEmitter } from 'node:events';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { KnowledgeAgentController } from './knowledge-agent.controller';
import type { KnowledgeAgentService } from './knowledge-agent.service';

describe('KnowledgeAgentController', () => {
  it('propagates an aborted HTTP request and removes the listener after completion', async () => {
    let observedSignal: AbortSignal | undefined;
    let resolveSuggestions: (() => void) | undefined;
    const service = {
      getSuggestions: jest.fn(
        (_userId: string, _query: unknown, signal?: AbortSignal) => {
          observedSignal = signal;
          return new Promise((resolve) => {
            resolveSuggestions = () => resolve(responseFixture());
          });
        },
      ),
    };
    const request = new EventEmitter();
    const controller = new KnowledgeAgentController(
      service as unknown as KnowledgeAgentService,
    );

    const pending = controller.getSuggestions(
      { id: 'user_1' } as AuthenticatedUser,
      { limit: '20' },
      request as never,
    );
    expect(observedSignal).toBeInstanceOf(AbortSignal);
    request.emit('aborted');
    expect(observedSignal?.aborted).toBe(true);
    resolveSuggestions?.();
    await pending;

    expect(request.listenerCount('aborted')).toBe(0);
  });
});

function responseFixture() {
  const runtime = {
    source: 'local_deterministic' as const,
    disposition: 'gate_disabled' as const,
    reasonCode: 'gate_disabled',
    attempted: false,
    degraded: false,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      pricingKnown: false,
      estimatedCostCny: null,
    },
    traceId: null,
  };
  return {
    generatedAt: '2026-07-21T08:00:00.000Z',
    dedup: { summary: '', items: [], signals: [], runtime },
    organizer: { summary: '', collections: [], tags: [], signals: [], runtime },
  };
}
