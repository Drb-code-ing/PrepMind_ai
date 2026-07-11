import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { conversationStateSchema } from '@repo/types/api/conversation-context';
import type { ConversationStateResponse } from '@repo/types/api/conversation-context';

export const CONVERSATION_STATE_REDIS = Symbol('CONVERSATION_STATE_REDIS');

export interface ConversationStateRedis {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    ttlSeconds: number,
  ): Promise<unknown>;
  del(key: string): Promise<unknown>;
  disconnect?(): void;
}

export interface ConversationStateCache {
  get(
    userId: string,
    conversationId: string,
  ): Promise<ConversationStateResponse | null>;
  set(userId: string, value: ConversationStateResponse): Promise<void>;
  delete(userId: string, conversationId: string): Promise<void>;
}

const MAX_TTL_SECONDS = 86_400;

@Injectable()
export class ConversationStateCacheService
  implements ConversationStateCache, OnModuleDestroy
{
  private readonly logger = new Logger(ConversationStateCacheService.name);

  constructor(
    @Inject(CONVERSATION_STATE_REDIS)
    private readonly redis: ConversationStateRedis,
  ) {}

  async get(userId: string, conversationId: string) {
    try {
      const raw = await this.redis.get(this.key(userId, conversationId));
      if (!raw) return null;

      const parsed = conversationStateSchema.safeParse(JSON.parse(raw));
      if (!parsed.success || parsed.data.conversationId !== conversationId) {
        this.logger.warn('CONVERSATION_STATE_CACHE_READ_FAILED');
        return null;
      }
      return parsed.data;
    } catch {
      this.logger.warn('CONVERSATION_STATE_CACHE_READ_FAILED');
      return null;
    }
  }

  async set(userId: string, value: ConversationStateResponse) {
    try {
      const parsed = conversationStateSchema.parse(value);
      const ttlSeconds = Math.min(
        MAX_TTL_SECONDS,
        Math.floor((new Date(parsed.expiresAt).getTime() - Date.now()) / 1000),
      );
      if (ttlSeconds <= 0) {
        await this.redis.del(this.key(userId, parsed.conversationId));
        return;
      }
      await this.redis.set(
        this.key(userId, parsed.conversationId),
        JSON.stringify(parsed),
        'EX',
        ttlSeconds,
      );
    } catch {
      this.logger.warn('CONVERSATION_STATE_CACHE_WRITE_FAILED');
    }
  }

  async delete(userId: string, conversationId: string) {
    try {
      await this.redis.del(this.key(userId, conversationId));
    } catch {
      this.logger.warn('CONVERSATION_STATE_CACHE_DELETE_FAILED');
    }
  }

  onModuleDestroy() {
    this.redis.disconnect?.();
  }

  private key(userId: string, conversationId: string) {
    const digest = createHash('sha256')
      .update(`${userId}\u0000${conversationId}`)
      .digest('hex');
    return `prepmind:conversation-state:${digest}`;
  }
}
