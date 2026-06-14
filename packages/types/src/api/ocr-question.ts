import { z } from 'zod';

import { createWrongQuestionRequestSchema } from '@repo/types/api/wrong-question';

const subjectEnumSchema = z.enum(['数学', '英语', '物理', '化学', '生物', '计算机', '其他']);
const questionTypeEnumSchema = z.enum([
  'single_choice',
  'multiple_choice',
  'blank',
  'calculation',
  'proof',
  'short_answer',
  'essay',
  'unknown',
]);
const difficultyEnumSchema = z.enum(['easy', 'medium', 'hard', 'unknown']);
const errorSuggestionEnumSchema = z.enum([
  '概念不清',
  '审题错误',
  '计算错误',
  '方法不会',
  '公式记忆遗漏',
  '记忆遗漏',
  '其他',
]);
const saveStatusEnumSchema = z.enum(['savable', 'needs_review', 'not_savable']);

export const ocrRecognitionTypeSchema = z.enum([
  'question',
  'multi_question',
  'non_question',
  'unclear',
]);

export const ocrSubjectSchema = subjectEnumSchema.catch('其他');
export const ocrQuestionTypeSchema = questionTypeEnumSchema.catch('unknown');
export const ocrDifficultySchema = difficultyEnumSchema.catch('unknown');
export const ocrErrorSuggestionSchema = errorSuggestionEnumSchema.catch('其他');
export const ocrQuestionSaveStatusSchema = saveStatusEnumSchema.catch('not_savable');

export const ocrQuestionResultSchema = z.object({
  id: z.string().min(1).max(100),
  index: z.number().int().min(1),
  questionText: z.string().max(20_000).default(''),
  options: z.array(z.string().max(2_000)).max(20).default([]),
  subject: ocrSubjectSchema.default('其他'),
  questionType: ocrQuestionTypeSchema.default('unknown'),
  difficulty: ocrDifficultySchema.default('unknown'),
  knowledgePoints: z.array(z.string().min(1).max(100)).max(20).default([]),
  answer: z.string().max(20_000).default(''),
  analysis: z.string().max(30_000).default(''),
  errorSuggestion: ocrErrorSuggestionSchema.default('其他'),
  saveStatus: ocrQuestionSaveStatusSchema.default('not_savable'),
  confidence: z.number().min(0).max(1).default(0),
  displayMarkdown: z.string().max(50_000).default(''),
  warnings: z.array(z.string().min(1).max(500)).max(20).default([]),
});

export const ocrStructuredResultSchema = z.object({
  recognitionType: ocrRecognitionTypeSchema,
  summary: z.string().max(5_000).default(''),
  questions: z.array(ocrQuestionResultSchema).max(20).default([]),
  rawText: z.string().max(100_000).default(''),
  displayMarkdown: z.string().max(100_000).default(''),
  modelVersion: z.string().max(100).default('unknown'),
});

export const createWrongQuestionToolActionProposalSchema = z.object({
  type: z.literal('createWrongQuestion'),
  label: z.string().min(1).max(100),
  reason: z.string().min(1).max(1_000),
  payload: createWrongQuestionRequestSchema,
  requiresUserConfirmation: z.literal(true),
});

export const searchKnowledgeToolActionProposalSchema = z.object({
  type: z.literal('searchKnowledge'),
  query: z.string().min(1).max(1_000),
  knowledgePoints: z.array(z.string().min(1).max(100)).max(20).default([]),
  requiresUserConfirmation: z.literal(false),
});

export const createReviewTaskToolActionProposalSchema = z.object({
  type: z.literal('createReviewTask'),
  questionId: z.string().min(1).max(100),
  knowledgePoints: z.array(z.string().min(1).max(100)).max(20).default([]),
  reason: z.string().min(1).max(1_000),
  requiresUserConfirmation: z.literal(true),
});

export const toolActionProposalSchema = z.discriminatedUnion('type', [
  createWrongQuestionToolActionProposalSchema,
  searchKnowledgeToolActionProposalSchema,
  createReviewTaskToolActionProposalSchema,
]);

export type OcrRecognitionType = z.infer<typeof ocrRecognitionTypeSchema>;
export type OcrQuestionResult = z.infer<typeof ocrQuestionResultSchema>;
export type OcrStructuredResult = z.infer<typeof ocrStructuredResultSchema>;
export type ToolActionProposal = z.infer<typeof toolActionProposalSchema>;
