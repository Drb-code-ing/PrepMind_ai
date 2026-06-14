import { NextRequest } from 'next/server';

import { OCR_SYSTEM_PROMPT, OCR_USER_PROMPT } from '@/lib/ocr-prompt';

const MIMO_API_URL = 'https://api.xiaomimimo.com/v1/chat/completions';
const MIMO_MODEL = 'mimo-v2.5';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const userText = formData.get('text') as string | null;

    if (!image) {
      return new Response(JSON.stringify({ error: '请提供图片' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = image.type || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64}`;
    const upstreamController = new AbortController();
    const timeoutId = setTimeout(() => upstreamController.abort(), 120_000);
    const abortUpstream = () => upstreamController.abort();
    const cleanupUpstream = () => {
      clearTimeout(timeoutId);
      req.signal.removeEventListener('abort', abortUpstream);
    };

    if (req.signal.aborted) {
      upstreamController.abort();
    } else {
      req.signal.addEventListener('abort', abortUpstream, { once: true });
    }

    // 调用 MIMO v2.5 streaming
    let response: Response;
    try {
      response = await fetch(MIMO_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MIMO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MIMO_MODEL,
          stream: true,
          messages: [
            { role: 'system', content: OCR_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: userText?.trim() || OCR_USER_PROMPT,
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUri },
                },
              ],
            },
          ],
        }),
        signal: upstreamController.signal,
      });
    } catch (error) {
      cleanupUpstream();
      throw error;
    }

    if (!response.ok) {
      const err = await response.text();
      cleanupUpstream();
      console.error('MIMO API error:', response.status, err);
      return new Response(JSON.stringify({ error: '图片识别服务暂时不可用，请稍后重试' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 转发 MIMO SSE 流到客户端
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const processLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) return;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          } catch {
            /* skip unparseable */
          }
        };

        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) processLine(line);
          }
          // Flush remaining buffer
          if (buffer.trim()) processLine(buffer);
        } catch (err) {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            console.error('Stream error:', err);
          }
        } finally {
          cleanupUpstream();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('OCR route error:', err);
    return new Response(JSON.stringify({ error: '识别过程中发生错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
