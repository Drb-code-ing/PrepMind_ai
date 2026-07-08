import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { OperatorGuard } from './operator.guard';

describe('OperatorGuard', () => {
  it('allows admin users to access operator diagnostics', () => {
    const guard = new OperatorGuard();

    expect(guard.canActivate(createContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('rejects student users from operator diagnostics', () => {
    const guard = new OperatorGuard();

    expect(() => guard.canActivate(createContext({ role: 'STUDENT' }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects requests before JwtAuthGuard attaches a user', () => {
    const guard = new OperatorGuard();

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});

function createContext(
  user: { role: 'STUDENT' | 'ADMIN' } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}
