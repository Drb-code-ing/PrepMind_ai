export type ChunkInput = {
  documentId: string;
  sourceName: string;
  text: string;
  metadata?: Record<string, unknown>;
};

export type ChunkingOptions = {
  targetTokens?: number;
  overlapTokens?: number;
  maxTokens?: number;
};

export type TextChunk = {
  index: number;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown> & {
    documentId: string;
    sourceName: string;
    chunkIndex: number;
    sectionTitle?: string;
  };
};

type TextUnit = {
  text: string;
  tokenCount: number;
  sectionTitle?: string;
};

type NormalizedChunkingOptions = Required<ChunkingOptions>;

const DEFAULT_TARGET_TOKENS = 650;
const DEFAULT_OVERLAP_TOKENS = 80;
const DEFAULT_MAX_TOKENS = 900;

export function tokenizeApprox(text: string): number {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  const cjkChars = normalized.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const words = normalized.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0;
  const symbols = normalized.match(/[^\s\ud800-\udfff\w\u3400-\u9fff]/g)?.length ?? 0;

  return Math.max(1, cjkChars + words + symbols);
}

export function splitDocument(input: ChunkInput, options: ChunkingOptions = {}): TextChunk[] {
  const { targetTokens, overlapTokens, maxTokens } = normalizeOptions(options);
  const units = createTextUnits(input.text, maxTokens);
  const chunks: TextChunk[] = [];
  let currentUnits: TextUnit[] = [];
  let currentTokens = 0;

  for (const unit of units) {
    if (currentUnits.length > 0 && isSectionBoundary(currentUnits, unit)) {
      chunks.push(createChunk(input, chunks.length, currentUnits, currentTokens));
      currentUnits = [];
      currentTokens = 0;
    }

    if (currentUnits.length > 0 && currentTokens + unit.tokenCount > targetTokens) {
      chunks.push(createChunk(input, chunks.length, currentUnits, currentTokens));
      currentUnits = createOverlapUnits(currentUnits, overlapTokens, maxTokens - unit.tokenCount);
      currentTokens = sumTokens(currentUnits);
    }

    if (currentTokens + unit.tokenCount > maxTokens && currentUnits.length > 0) {
      chunks.push(createChunk(input, chunks.length, currentUnits, currentTokens));
      currentUnits = [];
      currentTokens = 0;
    }

    currentUnits.push(unit);
    currentTokens += unit.tokenCount;
  }

  if (currentUnits.length > 0) {
    chunks.push(createChunk(input, chunks.length, currentUnits, currentTokens));
  }

  return chunks;
}

function normalizeOptions(options: ChunkingOptions): NormalizedChunkingOptions {
  const targetTokens = options.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const configuredMaxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  assertPositiveInteger('targetTokens', targetTokens);
  assertNonNegativeInteger('overlapTokens', overlapTokens);
  assertPositiveInteger('maxTokens', configuredMaxTokens);

  if (overlapTokens >= Math.floor(targetTokens / 2)) {
    throw new Error('overlapTokens must be less than half of targetTokens');
  }

  return {
    targetTokens,
    overlapTokens,
    maxTokens: Math.max(targetTokens, configuredMaxTokens),
  };
}

function assertPositiveInteger(name: string, value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertNonNegativeInteger(name: string, value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function createTextUnits(text: string, maxTokens: number): TextUnit[] {
  const paragraphs = normalizeParagraphs(text);
  const units: TextUnit[] = [];
  let sectionTitle: string | undefined;

  for (const paragraph of paragraphs) {
    const parsedParagraph = splitParagraphByHeadingLines(paragraph);

    for (const part of parsedParagraph) {
      if (part.type === 'heading') {
        sectionTitle = part.title;
        continue;
      }

      for (const unitText of splitOversizedText(part.text, maxTokens)) {
        const tokenCount = tokenizeApprox(unitText);

        if (tokenCount > 0) {
          units.push({ text: unitText, tokenCount, sectionTitle });
        }
      }
    }
  }

  return units;
}

function splitParagraphByHeadingLines(
  paragraph: string,
): Array<{ type: 'heading'; title: string } | { type: 'content'; text: string }> {
  const parts: Array<{ type: 'heading'; title: string } | { type: 'content'; text: string }> = [];
  let contentLines: string[] = [];

  for (const line of paragraph.split('\n')) {
    const headingTitle = parseMarkdownHeading(line);

    if (headingTitle) {
      if (contentLines.length > 0) {
        parts.push({ type: 'content', text: contentLines.join('\n') });
        contentLines = [];
      }

      parts.push({ type: 'heading', title: headingTitle });
      continue;
    }

    contentLines.push(line);
  }

  if (contentLines.length > 0) {
    parts.push({ type: 'content', text: contentLines.join('\n') });
  }

  return parts;
}

function normalizeParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);
}

function parseMarkdownHeading(text: string): string | undefined {
  const match = /^(#{1,6})\s+(.+?)\s*#*$/.exec(text.trim());

  return match?.[2]?.trim() || undefined;
}

function splitOversizedText(text: string, maxTokens: number): string[] {
  if (tokenizeApprox(text) <= maxTokens) {
    return [text];
  }

  const sentences = text
    .split(/(?<=[\u3002\uff01\uff1f\uff1b;.!?])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const splitTexts = sentences.length > 1 ? sentences : [text];
  const units: string[] = [];

  for (const splitText of splitTexts) {
    if (tokenizeApprox(splitText) <= maxTokens) {
      units.push(splitText);
      continue;
    }

    units.push(...splitByCharacters(splitText, maxTokens));
  }

  return units;
}

function splitByCharacters(text: string, maxTokens: number): string[] {
  const chunks: string[] = [];
  let buffer = '';

  for (const char of Array.from(text)) {
    const next = `${buffer}${char}`;

    if (buffer && tokenizeApprox(next) > maxTokens) {
      chunks.push(buffer.trim());
      buffer = char;
      continue;
    }

    buffer = next;
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

function createOverlapUnits(
  units: TextUnit[],
  overlapTokens: number,
  availableTokens: number,
): TextUnit[] {
  if (overlapTokens === 0 || availableTokens <= 0) {
    return [];
  }

  const selected: TextUnit[] = [];
  let selectedTokens = 0;
  const budget = Math.min(overlapTokens, availableTokens);

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];

    if (!unit || selectedTokens + unit.tokenCount > budget) {
      break;
    }

    selected.unshift(unit);
    selectedTokens += unit.tokenCount;
  }

  return selected;
}

function isSectionBoundary(units: TextUnit[], nextUnit: TextUnit): boolean {
  return units[units.length - 1]?.sectionTitle !== nextUnit.sectionTitle;
}

function createChunk(
  input: ChunkInput,
  index: number,
  units: TextUnit[],
  tokenCount: number,
): TextChunk {
  const sectionTitle = findLastSectionTitle(units);
  const metadata: TextChunk['metadata'] = {
    ...input.metadata,
    documentId: input.documentId,
    sourceName: input.sourceName,
    chunkIndex: index,
  };

  if (sectionTitle) {
    metadata.sectionTitle = sectionTitle;
  }

  return {
    index,
    content: units.map((unit) => unit.text).join('\n\n'),
    tokenCount,
    metadata,
  };
}

function sumTokens(units: TextUnit[]): number {
  return units.reduce((sum, unit) => sum + unit.tokenCount, 0);
}

function findLastSectionTitle(units: TextUnit[]): string | undefined {
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const sectionTitle = units[index]?.sectionTitle;

    if (sectionTitle) {
      return sectionTitle;
    }
  }

  return undefined;
}
