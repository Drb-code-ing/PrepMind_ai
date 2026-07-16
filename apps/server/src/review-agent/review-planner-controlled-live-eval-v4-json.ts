import {
  createTrustedDeepSeekV4JsonExecutor,
  type StructuredModelExecutor,
  type TrustedDeepSeekV4JsonFetch,
} from '@repo/ai';

const V4_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const V4_DEEPSEEK_MODEL = 'deepseek-v4-flash';

export type ReviewPlannerControlledLiveV4Fetch = TrustedDeepSeekV4JsonFetch;

type V4DeepSeekConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: string;
  model: string;
}>;

/**
 * V4 owns the narrow configuration boundary. The returned direct-fetch
 * adapter itself is implemented inside @repo/ai, where only first-party code
 * can create the private structured-output stage signal.
 */
export function createReviewPlannerControlledLiveV4JsonExecutor(
  config: V4DeepSeekConfig,
  dependencies: Readonly<{ fetch: ReviewPlannerControlledLiveV4Fetch }>,
): StructuredModelExecutor {
  return createTrustedDeepSeekV4JsonExecutor(normalizeV4Config(config), {
    fetch: dependencies.fetch,
  });
}

function normalizeV4Config(config: V4DeepSeekConfig): V4DeepSeekConfig {
  try {
    if (
      typeof config !== 'object' ||
      config === null ||
      config.provider !== 'deepseek' ||
      typeof config.apiKey !== 'string' ||
      !config.apiKey.trim() ||
      config.baseURL !== V4_DEEPSEEK_BASE_URL ||
      config.model !== V4_DEEPSEEK_MODEL
    ) {
      throw new Error();
    }
    return {
      provider: 'deepseek',
      apiKey: config.apiKey.trim(),
      baseURL: V4_DEEPSEEK_BASE_URL,
      model: V4_DEEPSEEK_MODEL,
    };
  } catch {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }
}
