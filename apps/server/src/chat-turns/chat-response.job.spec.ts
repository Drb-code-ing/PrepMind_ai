import {
  chatResponseCompletedEventPayloadSchema,
  chatResponseFailedEventPayloadSchema,
  chatResponseJobPayloadSchema,
} from './chat-response.job';

describe('chat response queue contracts', () => {
  const base = {
    turnId: 'turn_1',
    backgroundJobId: 'job_1',
    inputHash: `sha256:${'a'.repeat(64)}`,
    budgetPolicyVersion: 'chat-budget-v1',
  } as const;

  it('accepts the bounded requested payload and rejects prompt leakage', () => {
    expect(chatResponseJobPayloadSchema.safeParse(base).success).toBe(true);
    expect(
      chatResponseJobPayloadSchema.safeParse({
        ...base,
        prompt: 'must not cross the queue boundary',
      }).success,
    ).toBe(false);
  });

  it('rejects malformed identifiers, hashes, and budget versions', () => {
    expect(
      chatResponseJobPayloadSchema.safeParse({
        ...base,
        turnId: '',
      }).success,
    ).toBe(false);
    expect(
      chatResponseJobPayloadSchema.safeParse({
        ...base,
        inputHash: 'sha256:ABC',
      }).success,
    ).toBe(false);
    expect(
      chatResponseJobPayloadSchema.safeParse({
        ...base,
        budgetPolicyVersion: 'x'.repeat(81),
      }).success,
    ).toBe(false);
    expect(
      chatResponseJobPayloadSchema.safeParse({
        ...base,
        turnId: 't'.repeat(129),
      }).success,
    ).toBe(false);
  });

  it('keeps completed and failed terminal payloads strict and typed', () => {
    expect(
      chatResponseCompletedEventPayloadSchema.safeParse({
        ...base,
        responseMessageId: 'response_1',
      }).success,
    ).toBe(true);
    expect(
      chatResponseCompletedEventPayloadSchema.safeParse({
        ...base,
        responseMessageId: 'response_1',
        providerContent: 'secret',
      }).success,
    ).toBe(false);
    expect(
      chatResponseFailedEventPayloadSchema.safeParse({
        ...base,
        errorCode: 'PROVIDER_FAILURE',
      }).success,
    ).toBe(true);
    expect(
      chatResponseFailedEventPayloadSchema.safeParse({
        ...base,
        errorCode: 'UNKNOWN_ERROR',
      }).success,
    ).toBe(false);
  });
});
