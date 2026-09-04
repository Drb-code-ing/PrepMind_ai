import { createDataStreamResponse, formatDataStreamPart } from 'ai';
import {
  chatTurnHandoffAnnotationSchema,
  type ChatTurnEnqueueResponse,
} from '@repo/types/api/chat-turn';

export function createChatTurnHandoffResponse(result: ChatTurnEnqueueResponse) {
  return createDataStreamResponse({
    status: 202,
    headers: {
      'x-prepmind-chat-turn-path': 'turn-backed',
      'x-prepmind-chat-turn-id': result.turn.id,
      'x-prepmind-chat-turn-status': result.turn.status,
    },
    execute: async (dataStream) => {
      dataStream.writeMessageAnnotation(
        chatTurnHandoffAnnotationSchema.parse({
          type: 'prepmind-chat-turn-handoff-v1',
          turnId: result.turn.id,
          conversationId: result.turn.conversationId,
          status: result.turn.status,
          backgroundJobId: result.backgroundJob.id,
        }),
      );
      dataStream.write(
        formatDataStreamPart('text', '回答已加入后台处理。请稍后刷新页面查看结果，再继续发送。'),
      );
    },
  });
}
