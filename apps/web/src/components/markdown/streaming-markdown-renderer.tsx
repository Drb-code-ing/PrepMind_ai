'use client';

import { memo, useMemo } from 'react';

import { splitStreamingMarkdownContent } from '@/lib/streaming-markdown';
import MarkdownRenderer from './markdown-renderer';

function StreamingMarkdownRenderer({
  content,
  showCursor = true,
}: {
  content: string;
  showCursor?: boolean;
}) {
  const { stableMarkdown, liveText } = useMemo(
    () => splitStreamingMarkdownContent(content),
    [content],
  );

  return (
    <div className="space-y-2">
      {stableMarkdown && <MarkdownRenderer content={stableMarkdown} />}
      {(liveText || showCursor) && (
        <div className="whitespace-pre-wrap break-words">
          {liveText}
          {showCursor && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground align-[-0.15em]" />
          )}
        </div>
      )}
    </div>
  );
}

export default memo(StreamingMarkdownRenderer);
