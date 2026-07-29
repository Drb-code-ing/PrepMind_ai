import { createHash } from 'node:crypto';

import type { WrongQuestionOrganizerV5ShortlistSource } from '../../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';

const SNAPSHOT_VERSION = 'wrong-question-organizer-owner-snapshot-v1';

export function createV9R1Source(): WrongQuestionOrganizerV5ShortlistSource {
  return {
    ownerDomain: `hmac-sha256:${'a'.repeat(64)}`,
    ownerSnapshotVersion: SNAPSHOT_VERSION,
    ownerSnapshotFingerprint: fingerprint('v9-r1-source'),
    safety: 'safe_for_model',
    questions: [
      {
        id: 'q-v9-limit',
        subject: '数学',
        category: '高等数学',
        knowledgePoints: ['函数极限', '导数应用'],
        errorType: '计算错误',
        questionText: '比较函数极限与导数应用中的局部变换。',
        analysis: '先识别极限结构，再判断是否需要导数工具。',
        status: 'UNRESOLVED',
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
    ],
    decks: [
      {
        id: 'deck-v9-limit',
        subject: '数学',
        name: '函数极限',
        nameLocked: true,
        keywords: ['极限', '无穷小'],
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
      {
        id: 'deck-v9-derivative',
        subject: '数学',
        name: '导数应用',
        nameLocked: false,
        keywords: ['导数', '单调性'],
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
    ],
  };
}

export function createV9R1ZeroOptionSource(): WrongQuestionOrganizerV5ShortlistSource {
  return {
    ownerDomain: `hmac-sha256:${'b'.repeat(64)}`,
    ownerSnapshotVersion: SNAPSHOT_VERSION,
    ownerSnapshotFingerprint: fingerprint('v9-r1-zero-option'),
    safety: 'safe_for_model',
    questions: [
      {
        id: 'q-v9-no-option',
        subject: '其他',
        questionText: '请整理这一条没有专题信号的普通记录。',
        status: 'UNRESOLVED',
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
    ],
    decks: [],
  };
}

export function createV9R1OverBudgetSource(): WrongQuestionOrganizerV5ShortlistSource {
  const longQuestion = '函数极限与等价无穷小'.repeat(80);
  const longAnalysis = '逐项检查局部替换条件并保持定义域约束'.repeat(80);
  return {
    ownerDomain: `hmac-sha256:${'c'.repeat(64)}`,
    ownerSnapshotVersion: SNAPSHOT_VERSION,
    ownerSnapshotFingerprint: fingerprint('v9-r1-over-budget'),
    safety: 'safe_for_model',
    questions: Array.from({ length: 12 }, (_, index) => ({
      id: `q-v9-budget-${String(index).padStart(2, '0')}`,
      subject: '数学',
      category: '高等数学',
      knowledgePoints: ['函数极限'],
      errorType: '计算错误',
      questionText: longQuestion,
      analysis: longAnalysis,
      status: 'UNRESOLVED',
      updatedAt: '2026-07-29T08:00:00.000Z',
    })),
    decks: [
      {
        id: 'deck-v9-budget-limit',
        subject: '数学',
        name: '函数极限',
        nameLocked: true,
        keywords: ['极限'],
        updatedAt: '2026-07-29T08:00:00.000Z',
      },
    ],
  };
}

function fingerprint(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
