import { EventEmitter } from 'node:events';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WrongQuestionOrganizerController } from './wrong-question-organizer.controller';
import type { WrongQuestionOrganizerService } from './wrong-question-organizer.service';

describe('WrongQuestionOrganizerController', () => {
  it.each([
    ['single', 'organizeOne'] as const,
    ['batch', 'organizeBatch'] as const,
  ])(
    'propagates and cleans the HTTP abort listener for %s organization',
    async (_label, method) => {
      let observedSignal: AbortSignal | undefined;
      let resolveRequest: (() => void) | undefined;
      const response =
        method === 'organizeOne' ? singleResponse() : batchResponse();
      const service = {
        organizeOne: jest.fn(
          (
            _userId: string,
            _wrongQuestionId: string,
            _input: unknown,
            signal?: AbortSignal,
          ) => {
            observedSignal = signal;
            return new Promise((resolve) => {
              resolveRequest = () => resolve(response);
            });
          },
        ),
        organizeBatch: jest.fn(
          (_userId: string, _input: unknown, signal?: AbortSignal) => {
            observedSignal = signal;
            return new Promise((resolve) => {
              resolveRequest = () => resolve(response);
            });
          },
        ),
      };
      const request = new EventEmitter();
      Object.defineProperty(request, 'aborted', {
        configurable: true,
        value: false,
      });
      const controller = new WrongQuestionOrganizerController(
        service as unknown as WrongQuestionOrganizerService,
      );
      const user = { id: 'user_1' } as AuthenticatedUser;

      const pending =
        method === 'organizeOne'
          ? controller.organizeOne(
              user,
              'wrong_1',
              { force: false },
              request as never,
            )
          : controller.organizeBatch(user, { limit: 2 }, request as never);
      expect(observedSignal).toBeInstanceOf(AbortSignal);
      request.emit('aborted');
      expect(observedSignal?.aborted).toBe(true);
      resolveRequest?.();
      await expect(pending).resolves.toEqual(response);

      expect(request.listenerCount('aborted')).toBe(0);
    },
  );
});

function singleResponse() {
  return {
    subjectGroup: {},
    deck: {},
    item: {},
    createdSubjectGroup: false,
    createdDeck: false,
    createdItem: false,
    reason: '',
    confidence: 0.5,
    runtime: {
      source: 'local_deterministic',
      disposition: 'gate_disabled',
      degraded: false,
    },
  };
}

function batchResponse() {
  return {
    organizedCount: 0,
    skippedCount: 0,
    items: [],
    runtime: {
      source: 'local_deterministic',
      disposition: 'gate_disabled',
      degraded: false,
    },
  };
}
