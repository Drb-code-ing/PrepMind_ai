export type StreamingMarkdownParts = {
  stableMarkdown: string;
  liveText: string;
};

export function splitStreamingMarkdownContent(content: string): StreamingMarkdownParts {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized) {
    return { stableMarkdown: '', liveText: '' };
  }

  const splitIndex = findLastSafeBlankLineBoundary(normalized);
  if (splitIndex <= 0) {
    return { stableMarkdown: '', liveText: normalized };
  }

  return {
    stableMarkdown: normalized.slice(0, splitIndex).trimEnd(),
    liveText: normalized.slice(splitIndex).replace(/^\n+/, ''),
  };
}

function findLastSafeBlankLineBoundary(content: string) {
  const lines = content.match(/[^\n]*(?:\n|$)/g) ?? [];
  let offset = 0;
  let lastSafeBoundary = 0;
  let inCodeFence = false;
  let inMathFence = false;

  for (const lineWithEnding of lines) {
    if (!lineWithEnding) continue;

    const line = lineWithEnding.endsWith('\n')
      ? lineWithEnding.slice(0, -1)
      : lineWithEnding;
    const trimmed = line.trim();
    const lineEnd = offset + lineWithEnding.length;

    if (isCodeFenceLine(trimmed)) {
      inCodeFence = !inCodeFence;
    } else if (!inCodeFence && hasOddBlockMathFenceCount(trimmed)) {
      inMathFence = !inMathFence;
    }

    if (trimmed === '' && !inCodeFence && !inMathFence) {
      lastSafeBoundary = lineEnd;
    }

    offset = lineEnd;
  }

  return lastSafeBoundary;
}

function isCodeFenceLine(line: string) {
  return /^(```|~~~)/.test(line);
}

function hasOddBlockMathFenceCount(line: string) {
  const matches = line.match(/\$\$/g);
  return Boolean(matches && matches.length % 2 === 1);
}
