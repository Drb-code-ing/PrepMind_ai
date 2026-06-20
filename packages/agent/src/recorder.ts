import type { AgentRun, AgentStep } from '@repo/types/api/agent';

export type AgentRunRecorder = {
  startRun(run: AgentRun): void;
  finishRun(
    runId: string,
    patch: Pick<AgentRun, 'status' | 'finishedAt' | 'totalDurationMs'>,
  ): void;
  recordStep(step: AgentStep): void;
};

export class InMemoryAgentRunRecorder implements AgentRunRecorder {
  private readonly runs = new Map<string, AgentRun>();
  private readonly steps = new Map<string, AgentStep[]>();

  startRun(run: AgentRun): void {
    this.runs.set(run.id, run);
  }

  finishRun(
    runId: string,
    patch: Pick<AgentRun, 'status' | 'finishedAt' | 'totalDurationMs'>,
  ): void {
    const current = this.runs.get(runId);

    if (!current) {
      return;
    }

    this.runs.set(runId, {
      ...current,
      ...patch,
    });
  }

  recordStep(step: AgentStep): void {
    const current = this.steps.get(step.runId) ?? [];
    this.steps.set(step.runId, [...current, step]);
  }

  getRuns(): AgentRun[] {
    return [...this.runs.values()];
  }

  getSteps(runId: string): AgentStep[] {
    return this.steps.get(runId) ?? [];
  }
}
