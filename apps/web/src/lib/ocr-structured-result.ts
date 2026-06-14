import {
  ocrStructuredResultSchema,
  type OcrQuestionResult,
  type OcrStructuredResult,
} from '@repo/types/api/ocr-question';
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';

import type { ActiveStudyContext } from './chat-context.ts';
import type { WrongQuestionRecord } from './db.ts';
import {
  formatOcrContentForDisplay,
  getMissingWrongQuestionFields,
  parseOcrResult,
  type ParsedWrongQuestion,
} from './wrong-question-parser.ts';

export const OCR_DISPLAY_MARKDOWN_START = '<PREPMIND_DISPLAY_MARKDOWN>';
export const OCR_DISPLAY_MARKDOWN_END = '</PREPMIND_DISPLAY_MARKDOWN>';
export const OCR_STRUCTURED_JSON_START = '<PREPMIND_STRUCTURED_JSON>';
export const OCR_STRUCTURED_JSON_END = '</PREPMIND_STRUCTURED_JSON>';

export type StructuredActiveStudyContext = ActiveStudyContext & {
  questionId?: string;
  questionType?: OcrQuestionResult['questionType'];
  difficulty?: OcrQuestionResult['difficulty'];
  warnings?: string[];
};

type ActiveStudyContextOptions = {
  sourceGroupId?: string;
  rawContent?: string;
  updatedAt?: number;
};

type WrongQuestionMappingOptions = {
  id: string;
  userId: string;
  sourceRecordId?: string;
  sourceGroupId?: string;
  imageUrl?: string;
  now: number;
  rawContent: string;
};

export function extractOcrStructuredEnvelope(content: string) {
  const displayMarkdown = extractTaggedBlock(
    content,
    OCR_DISPLAY_MARKDOWN_START,
    OCR_DISPLAY_MARKDOWN_END,
  );
  const structuredJson = extractTaggedBlock(
    content,
    OCR_STRUCTURED_JSON_START,
    OCR_STRUCTURED_JSON_END,
  );
  const structuredResult = parseStructuredJsonBlock(structuredJson);

  return {
    displayMarkdown,
    structuredJson,
    structuredResult,
  };
}

export function toOcrStructuredResult(content: string, modelVersion = 'unknown'): OcrStructuredResult {
  const envelope = extractOcrStructuredEnvelope(content);
  if (envelope.structuredResult) {
    return ocrStructuredResultSchema.parse({
      ...envelope.structuredResult,
      displayMarkdown:
        envelope.displayMarkdown ||
        envelope.structuredResult.displayMarkdown ||
        getDisplayMarkdownFromLegacyContent(content),
      modelVersion: envelope.structuredResult.modelVersion || modelVersion,
    });
  }

  return legacyParsedToStructuredResult(parseOcrResult(content), modelVersion);
}

export function normalizeOcrParsedPayload(
  payload: OcrParsedPayload | null | undefined,
  fallbackContent = '',
): OcrStructuredResult {
  const structured = ocrStructuredResultSchema.safeParse(payload);
  if (structured.success) {
    return structured.data;
  }

  if (payload && 'isQuestion' in payload) {
    return legacyParsedToStructuredResult(
      {
        isQuestion: payload.isQuestion,
        nonQuestionSummary: payload.nonQuestionSummary ?? '',
        questionText: payload.questionText ?? '',
        subject: payload.subject ?? '其他',
        category: payload.category ?? payload.subject ?? '其他',
        knowledgePoints: payload.knowledgePoints ?? [],
        analysis: payload.analysis ?? '',
        answer: payload.answer ?? '',
        errorType: payload.errorSuggestion ?? '其他',
        rawContent: fallbackContent,
      },
      'legacy',
    );
  }

  return toOcrStructuredResult(fallbackContent, 'legacy');
}

export function getDisplayMarkdownFromOcrContent(content: string) {
  const envelope = extractOcrStructuredEnvelope(content);
  if (envelope.displayMarkdown) return envelope.displayMarkdown.trim();
  if (envelope.structuredResult?.displayMarkdown) {
    return envelope.structuredResult.displayMarkdown.trim();
  }

  return getDisplayMarkdownFromLegacyContent(content);
}

export function getPrimaryOcrQuestion(result: OcrStructuredResult) {
  return result.questions.find(canSaveStructuredQuestion);
}

export function canSaveStructuredQuestion(question: Pick<OcrQuestionResult, 'saveStatus'>) {
  return question.saveStatus === 'savable' || question.saveStatus === 'needs_review';
}

export function buildActiveStudyContextFromOcrQuestion(
  question: OcrQuestionResult,
  options: ActiveStudyContextOptions = {},
): StructuredActiveStudyContext {
  return {
    type: 'ocr-question',
    sourceGroupId: options.sourceGroupId,
    questionId: question.id,
    questionText: question.questionText,
    subject: question.subject,
    knowledgePoints: question.knowledgePoints,
    analysis: question.analysis,
    answer: question.answer,
    rawContent: options.rawContent ?? question.displayMarkdown,
    updatedAt: options.updatedAt,
    questionType: question.questionType,
    difficulty: question.difficulty,
    warnings: question.warnings,
  };
}

export function mapOcrQuestionToWrongQuestionRecord(
  question: OcrQuestionResult,
  options: WrongQuestionMappingOptions,
): WrongQuestionRecord {
  return {
    id: options.id,
    userId: options.userId,
    source: 'ocr',
    sourceRecordId: options.sourceRecordId,
    sourceGroupId: buildPerQuestionSourceGroupId(options.sourceGroupId, question.id),
    imageUrl: options.imageUrl,
    questionText: requiredText(question.questionText, '题干未识别完整'),
    subject: requiredText(question.subject, '其他'),
    category: question.knowledgePoints[0] ?? question.subject ?? '其他',
    knowledgePoints: question.knowledgePoints,
    analysis: question.analysis,
    answer: question.answer,
    errorType: question.errorSuggestion,
    userNote: '',
    rawContent: options.rawContent,
    status: 'unresolved',
    createdAt: options.now,
    updatedAt: options.now,
  };
}

function legacyParsedToStructuredResult(
  parsed: ParsedWrongQuestion,
  modelVersion: string,
): OcrStructuredResult {
  if (!parsed.isQuestion) {
    const summary = parsed.nonQuestionSummary || '图片中没有识别到可保存的题目。';
    return ocrStructuredResultSchema.parse({
      recognitionType: 'non_question',
      summary,
      questions: [],
      rawText: parsed.rawContent,
      displayMarkdown: summary,
      modelVersion,
    });
  }

  const missingFields = getMissingWrongQuestionFields(parsed);
  const question = {
    id: 'q1',
    index: 1,
    questionText: parsed.questionText,
    options: [],
    subject: parsed.subject,
    questionType: 'unknown',
    difficulty: 'unknown',
    knowledgePoints: parsed.knowledgePoints,
    answer: parsed.answer,
    analysis: parsed.analysis,
    errorSuggestion: parsed.errorType,
    saveStatus: missingFields.length === 0 ? 'savable' : 'needs_review',
    confidence: missingFields.length === 0 ? 0.75 : 0.5,
    displayMarkdown: getDisplayMarkdownFromLegacyContent(parsed.rawContent),
    warnings: missingFields.map(formatMissingFieldWarning),
  };

  return ocrStructuredResultSchema.parse({
    recognitionType: 'question',
    summary: '识别到 1 道题。',
    questions: [question],
    rawText: parsed.rawContent,
    displayMarkdown: question.displayMarkdown,
    modelVersion,
  });
}

function extractTaggedBlock(content: string, startTag: string, endTag: string) {
  const startIndex = content.indexOf(startTag);
  if (startIndex < 0) return '';

  const contentStart = startIndex + startTag.length;
  const endIndex = content.indexOf(endTag, contentStart);
  if (endIndex < 0) return content.slice(contentStart).trim();

  return content.slice(contentStart, endIndex).trim();
}

function parseStructuredJsonBlock(value: string) {
  if (!value.trim()) return null;

  try {
    return ocrStructuredResultSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

function getDisplayMarkdownFromLegacyContent(content: string) {
  return formatOcrContentForDisplay(stripOcrEnvelope(content));
}

function stripOcrEnvelope(content: string) {
  return content
    .replace(new RegExp(`${escapeRegExp(OCR_STRUCTURED_JSON_START)}[\\s\\S]*`, 'u'), '')
    .replace(OCR_DISPLAY_MARKDOWN_START, '')
    .replace(OCR_DISPLAY_MARKDOWN_END, '')
    .trim();
}

function buildPerQuestionSourceGroupId(sourceGroupId: string | undefined, questionId: string) {
  return sourceGroupId ? `${sourceGroupId}:${questionId}` : questionId;
}

function requiredText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatMissingFieldWarning(field: string) {
  const labels: Record<string, string> = {
    questionText: '题干不完整',
    knowledgePoints: '知识点缺失',
    analysis: '解析缺失',
    answer: '答案缺失',
  };

  return labels[field] ?? field;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
