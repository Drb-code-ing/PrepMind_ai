import type {
  ChatRunBudgetReservation,
  ChatRunBudgetReservationRequest,
  ChatRunBudgetStage,
  ChatRunBudgetUsage,
} from '@repo/types';

/**
 * Narrow capability injected by the server composition root. The agent
 * package can account a stage without depending on Prisma or Nest.
 */
export type AgentBudgetPort = {
  reserve(input: ChatRunBudgetReservationRequest): Promise<ChatRunBudgetReservation>;
  dispatch(ownerId: string, reservationId: string): Promise<BudgetTransition>;
  settle(ownerId: string, reservationId: string, usage: ChatRunBudgetUsage): Promise<BudgetTransition>;
  settleUncertain(
    ownerId: string,
    reservationId: string,
    usage: ChatRunBudgetUsage,
  ): Promise<BudgetTransition>;
  release(ownerId: string, reservationId: string): Promise<BudgetTransition>;
  uncertain(ownerId: string, reservationId: string): Promise<BudgetTransition>;
};

export type BudgetTransition =
  | { kind: 'not-found' }
  | { kind: 'conflict'; reservation: ChatRunBudgetReservation }
  | { kind: 'updated'; reservation: ChatRunBudgetReservation };

export type BudgetedStageInput = Omit<ChatRunBudgetReservationRequest, 'stage'> & {
  stage: ChatRunBudgetStage;
};

/**
 * Execute one stage with a durable reservation. Dispatch failures release the
 * reservation; provider failures mark it UNCERTAIN because execution may have
 * happened. The caller supplies bounded usage only after observing the result.
 */
export async function runBudgetedStage<T>(
  budget: AgentBudgetPort,
  input: BudgetedStageInput,
  execute: () => Promise<{ value: T; usage: ChatRunBudgetUsage }>,
): Promise<T> {
  const reservation = await budget.reserve(input);
  const dispatched = await budget.dispatch(input.ownerId, reservation.id);
  if (dispatched.kind !== 'updated') {
    await budget.release(input.ownerId, reservation.id);
    throw new Error('Agent stage budget reservation could not be dispatched');
  }

  try {
    const result = await execute();
    const settled = await budget.settle(input.ownerId, reservation.id, result.usage);
    if (settled.kind !== 'updated') {
      throw new Error('Agent stage budget settlement conflicted');
    }
    return result.value;
  } catch (error) {
    await budget.uncertain(input.ownerId, reservation.id);
    throw error;
  }
}
