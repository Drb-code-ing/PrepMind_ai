import { describe, expect, it } from 'bun:test';

import {
  createAgentLoopControl,
  recordAgentTransition,
  shouldStopAgentLoop,
} from '../src/control-plane';
import { createInitialAgentState } from '../src/state';

describe('agent control plane', () => {
  it('stops when max steps is reached', () => {
    const control = createAgentLoopControl({
      maxSteps: 2,
      startedAt: '2026-06-29T00:00:00.000Z',
    });

    const first = recordAgentTransition(control, 'RouterAgent', 'TutorAgent');
    const second = recordAgentTransition(first, 'TutorAgent', 'FinalResponseAgent');

    expect(shouldStopAgentLoop(second, '2026-06-29T00:00:01.000Z')).toEqual({
      stop: true,
      reason: 'max_steps',
    });
  });

  it('stops repeated transitions', () => {
    const control = createAgentLoopControl({
      maxSteps: 10,
      maxRepeatedTransition: 2,
      startedAt: '2026-06-29T00:00:00.000Z',
    });

    const first = recordAgentTransition(
      control,
      'RetrieverAgent',
      'KnowledgeVerifierAgent',
    );
    const second = recordAgentTransition(
      first,
      'RetrieverAgent',
      'KnowledgeVerifierAgent',
    );

    expect(shouldStopAgentLoop(second, '2026-06-29T00:00:01.000Z')).toEqual({
      stop: true,
      reason: 'repeated_transition',
    });
  });

  it('stops after deadline', () => {
    const control = createAgentLoopControl({
      maxSteps: 10,
      startedAt: '2026-06-29T00:00:00.000Z',
      deadlineAt: '2026-06-29T00:00:02.000Z',
    });

    expect(shouldStopAgentLoop(control, '2026-06-29T00:00:03.000Z')).toEqual({
      stop: true,
      reason: 'deadline',
    });
  });

  it('initializes loop metadata on new agent state', () => {
    const state = createInitialAgentState({
      runId: 'run_1',
      userId: 'user_1',
      text: 'Explain this step.',
      startedAt: '2026-06-29T00:00:00.000Z',
    });

    expect(state.loopControl).toEqual({
      stepCount: 0,
      maxSteps: 6,
      maxRepeatedTransition: 2,
      startedAt: '2026-06-29T00:00:00.000Z',
      transitions: [],
    });
  });
});
