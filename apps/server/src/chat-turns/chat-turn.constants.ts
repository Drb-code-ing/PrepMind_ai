export const CHAT_RESPONSE_QUEUE = 'chat-response';
export const CHAT_RESPONSE_JOB = 'generate-chat-response';
export const CHAT_RESPONSE_RESOURCE_TYPE = 'CHAT_RESPONSE';
export const CHAT_RESPONSE_REQUESTED_EVENT = 'chat.response.requested';
export const CHAT_RESPONSE_COMPLETED_EVENT = 'chat.response.completed';
export const CHAT_RESPONSE_FAILED_EVENT = 'chat.response.failed';

export const CHAT_RESPONSE_REQUESTED_IDEMPOTENCY_PREFIX =
  'chat.response.requested:';

export function chatResponseRequestedIdempotencyKey(turnId: string) {
  return `${CHAT_RESPONSE_REQUESTED_IDEMPOTENCY_PREFIX}${turnId}`;
}

export function chatResponseJobIdempotencyKey(turnId: string) {
  return `chat.response.job:${turnId}`;
}

export function chatResponseJobDedupeKey(turnId: string) {
  return `chat.response.active:${turnId}`;
}

export function chatResponseCompletedIdempotencyKey(turnId: string) {
  return `${CHAT_RESPONSE_COMPLETED_EVENT}:${turnId}`;
}

export function chatResponseFailedIdempotencyKey(turnId: string) {
  return `${CHAT_RESPONSE_FAILED_EVENT}:${turnId}`;
}
