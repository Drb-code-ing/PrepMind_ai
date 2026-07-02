import type { ServerEnv } from '../config/env';

export function shouldListenHttp(role: ServerEnv['SERVER_ROLE']) {
  return role === 'api' || role === 'both';
}
