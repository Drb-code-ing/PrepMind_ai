import { createOpenAI } from "@ai-sdk/openai";

/**
 * 统一 AI Provider 封装
 * 切换模型只改这里，业务代码不感知
 *
 * DeepSeek / OpenAI 都兼容 OpenAI 协议，用同一个 provider
 * 切 OpenAI：baseURL 改为 https://api.openai.com/v1
 */
export const aiProvider = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "",
  baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
});

/** 默认模型 */
export const DEFAULT_MODEL = process.env.AI_MODEL || "deepseek-chat";
