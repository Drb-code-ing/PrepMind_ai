import type { AgentLoopControl } from '@repo/types/api/agent';

export type CreateAgentLoopControlInput = {
  maxSteps: number;
  maxRepeatedTransition?: number;
  startedAt: string;
  deadlineAt?: string;
};

export type AgentLoopStopReason = 'none' | 'max_steps' | 'deadline' | 'repeated_transition';

export function createAgentLoopControl(
  input: CreateAgentLoopControlInput,
): AgentLoopControl {
  return {
    stepCount: 0,
    maxSteps: input.maxSteps,
    maxRepeatedTransition: input.maxRepeatedTransition ?? 2,
    startedAt: input.startedAt,
    deadlineAt: input.deadlineAt,
    transitions: [],
  };
}

export function recordAgentTransition(
  control: AgentLoopControl,
  from: string,
  to: string,
): AgentLoopControl {
  return {
    ...control,
    stepCount: control.stepCount + 1,
    transitions: [...control.transitions, `${from}->${to}`],
  };
}

export function shouldStopAgentLoop(
  control: AgentLoopControl,
  now: string,
): { stop: boolean; reason: AgentLoopStopReason } {
  if (control.stepCount >= control.maxSteps) {
    return { stop: true, reason: 'max_steps' };
  }

  if (control.deadlineAt && new Date(now).getTime() > new Date(control.deadlineAt).getTime()) {
    return { stop: true, reason: 'deadline' };
  }

  const counts = new Map<string, number>();
  for (const transition of control.transitions) {
    const count = (counts.get(transition) ?? 0) + 1;
    if (count >= control.maxRepeatedTransition) {
      return { stop: true, reason: 'repeated_transition' };
    }
    counts.set(transition, count);
  }

  return { stop: false, reason: 'none' };
}
