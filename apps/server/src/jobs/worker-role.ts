import type { ServerEnv } from '../config/env';

export function shouldRegisterWorkers(role: ServerEnv['SERVER_ROLE']) {
  return role === 'worker' || role === 'both';
}
