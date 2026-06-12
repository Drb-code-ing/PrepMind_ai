import assert from 'node:assert/strict';

import { splitStreamingMarkdownContent } from './streaming-markdown.ts';

function run() {
  testKeepsTrailingParagraphAsLiveText();
  testDoesNotRenderUnclosedCodeFenceAsStableMarkdown();
  testTreatsContentEndingAtBlankLineAsStable();
}

function testKeepsTrailingParagraphAsLiveText() {
  const result = splitStreamingMarkdownContent(
    [
      '## 题目',
      '已完整输出的题干。',
      '',
      '## 分析',
      '正在输出的最后一段',
    ].join('\n'),
  );

  assert.deepEqual(result, {
    stableMarkdown: '## 题目\n已完整输出的题干。',
    liveText: '## 分析\n正在输出的最后一段',
  });
}

function testDoesNotRenderUnclosedCodeFenceAsStableMarkdown() {
  const result = splitStreamingMarkdownContent(
    ['第一段已经完成。', '', '```ts', 'const answer ='].join('\n'),
  );

  assert.deepEqual(result, {
    stableMarkdown: '第一段已经完成。',
    liveText: '```ts\nconst answer =',
  });
}

function testTreatsContentEndingAtBlankLineAsStable() {
  const result = splitStreamingMarkdownContent('段落一\n\n段落二\n\n');

  assert.deepEqual(result, {
    stableMarkdown: '段落一\n\n段落二',
    liveText: '',
  });
}

run();
