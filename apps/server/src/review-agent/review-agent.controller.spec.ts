import { EventEmitter } from 'node:events';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewAgentController } from './review-agent.controller';
import type { ReviewAgentService } from './review-agent.service';

describe('ReviewAgentController', () => {
  it('propagates an aborted HTTP request and removes the listener after completion', async () => {
    let observedSignal: AbortSignal | undefined;
    let resolveSuggestions: (() => void) | undefined;
    const service = {
      getSuggestions: jest.fn(
        (
          _userId: string,
          _query: unknown,
          _acceptanceCapability?: unknown,
          signal?: AbortSignal,
        ) => {
          observedSignal = signal;
          return new Promise((resolve) => {
            resolveSuggestions = () => resolve(responseFixture());
          });
        },
      ),
    };
    const request = new EventEmitter();
    const controller = new ReviewAgentController(
      service as unknown as ReviewAgentService,
    );

    const pending = controller.getSuggestions(
      { id: 'user_1' } as AuthenticatedUser,
      {
        startDate: '2026-08-19',
        days: '7',
        timezoneOffsetMinutes: '-480',
      },
      undefined,
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
  const local = {
    attempted: false,
    disposition: 'not_eligible' as const,
    durationMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    provenance: 'local_deterministic' as const,
    degraded: true,
    cached: false,
  };
  return {
    generatedAt: '2026-08-19T08:00:00.000Z',
    review: {
      priority: 'low' as const,
      summary: 'No review pressure.',
      weakPoints: [],
      actions: [],
      signals: ['lowPressure' as const],
    },
    planner: {
      headline: 'Keep a steady rhythm.',
      todayFocus: 'Continue the current plan.',
      weekStrategy: 'Review daily.',
      suggestedBlocks: [],
      signals: ['normalPlan' as const],
    },
    planSummary: {
      overdueCount: 0,
      todayDueCount: 0,
      upcomingDueCount: 0,
      estimatedTotalMinutes: 0,
      peakDay: null,
      intensity: 'light' as const,
      capacityStatus: 'within' as const,
      dailyMinutes: 30,
      dailyCardLimit: 12,
    },
    modelObservations: { version: 1 as const, review: local, planner: local },
  };
}
