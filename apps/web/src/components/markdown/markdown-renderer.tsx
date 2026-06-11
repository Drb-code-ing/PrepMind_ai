'use client';

import { memo } from 'react';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {content}
      </Markdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
