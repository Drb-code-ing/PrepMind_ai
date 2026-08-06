import type { FinalResponseStreamEventV1 } from '@repo/agent/realtime-chat';

export function createFinalResponseDataStreamAdapterV1(
  input: Readonly<{
    citationMarkdown: string;
    writeText: (text: string) => void;
  }>,
): Readonly<{
  emit: (event: FinalResponseStreamEventV1) => Promise<void>;
  isTerminal: () => boolean;
}> {
  let expectedSequence = 0;
  let runId: string | null = null;
  let responseId: string | null = null;
  let phase: 'initial' | 'streaming' | 'citations' | 'terminal' = 'initial';
  let citationsDelivered = false;
  const invalidate = (code: string): never => {
    phase = 'terminal';
    throw new Error(code);
  };

  return Object.freeze({
    async emit(event) {
      if (
        phase === 'terminal' ||
        event.sequence !== expectedSequence ||
        (runId !== null && event.runId !== runId) ||
        (responseId !== null && event.responseId !== responseId)
      ) {
        invalidate('FINAL_RESPONSE_DATA_STREAM_SEQUENCE_INVALID');
      }
      if (event.event === 'response_started') {
        if (phase !== 'initial' || event.sequence !== 0) {
          invalidate('FINAL_RESPONSE_DATA_STREAM_STATE_INVALID');
        }
        phase = 'streaming';
      } else if (phase === 'initial') {
        invalidate('FINAL_RESPONSE_DATA_STREAM_STATE_INVALID');
      }
      runId ??= event.runId;
      responseId ??= event.responseId;
      expectedSequence += 1;

      if (event.event === 'text_delta') {
        if (phase !== 'streaming') {
          invalidate('FINAL_RESPONSE_DATA_STREAM_STATE_INVALID');
        }
        input.writeText(event.text);
        return;
      }
      if (event.event === 'citations') {
        if (
          phase !== 'streaming' ||
          citationsDelivered ||
          !input.citationMarkdown ||
          event.citations.length === 0
        ) {
          invalidate('FINAL_RESPONSE_DATA_STREAM_CITATION_INVALID');
        }
        citationsDelivered = true;
        phase = 'citations';
        input.writeText(`\n\n${input.citationMarkdown}`);
        return;
      }
      if (event.event === 'response_failed') {
        if (phase !== 'streaming') {
          invalidate('FINAL_RESPONSE_DATA_STREAM_STATE_INVALID');
        }
        phase = 'terminal';
        input.writeText(`\n\n${event.userMessage}`);
        return;
      }
      if (event.event === 'response_completed') {
        if (
          (phase !== 'streaming' && phase !== 'citations') ||
          Boolean(input.citationMarkdown) !== citationsDelivered
        ) {
          invalidate('FINAL_RESPONSE_DATA_STREAM_STATE_INVALID');
        }
        phase = 'terminal';
      }
    },
    isTerminal: () => phase === 'terminal',
  });
}
