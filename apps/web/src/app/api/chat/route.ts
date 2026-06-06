import { streamText } from "ai";
import { aiProvider, DEFAULT_MODEL } from "@/lib/ai-provider";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: aiProvider(DEFAULT_MODEL),
    system: `你是 PrepMind AI，一个专业的智能备考助手。你的职责是：
1. 帮助学生理解知识点，用简洁清晰的语言讲解
2. 解答题目时给出解题思路，不只给答案
3. 鼓励学生思考，适当引导
4. 回答使用中文，格式清晰，必要时使用 Markdown 列表或代码块`,
    messages,
  });

  return result.toDataStreamResponse();
}
