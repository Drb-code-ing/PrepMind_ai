import { NextRequest, NextResponse } from "next/server";

const MIMO_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const MIMO_MODEL = "mimo-v2.5";

const SYSTEM_PROMPT = `你是一个专业的考试题目识别助手。请仔细识别图片中的题目，并按以下格式结构化输出：

## 📋 题目
（完整题干内容）

## 📌 知识点
- （涉及的核心知识点）
- （相关概念或章节）

## 💡 分析思路
（解题的思考路径和关键步骤）

## ✅ 参考答案
（最终答案和简要解释）

注意事项：
- 如果图片中有多个题目，请逐一识别
- 如果图片不清晰，尽量识别并在分析中说明
- 如果不是题目内容，请说明图片实际内容`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const userText = formData.get("text") as string | null;

    if (!image) {
      return NextResponse.json({ error: "请提供图片" }, { status: 400 });
    }

    // 读取图片为 base64 data URI
    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = image.type || "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64}`;

    // 调用 MIMO v2.5
    const response = await fetch(MIMO_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MIMO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MIMO_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userText?.trim() || "请识别这道题目，给出详细的结构化分析",
              },
              {
                type: "image_url",
                image_url: { url: dataUri },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("MIMO API error:", response.status, err);
      return NextResponse.json(
        { error: "图片识别服务暂时不可用，请稍后重试" },
        { status: 502 },
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;

    if (!result) {
      return NextResponse.json(
        { error: "未能识别图片内容" },
        { status: 500 },
      );
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error("OCR route error:", err);
    return NextResponse.json(
      { error: "识别过程中发生错误" },
      { status: 500 },
    );
  }
}
