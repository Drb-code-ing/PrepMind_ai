import { describe, expect, it } from 'bun:test';

import { organizeWrongQuestion } from '../src/nodes/wrong-question-organizer';

const SUBJECT = '\u9ad8\u7b49\u6570\u5b66';
const CATEGORY = '\u66f2\u7ebf\u79ef\u5206';
const KNOWLEDGE_POINT = '\u683c\u6797\u516c\u5f0f';
const ERROR_TYPE = '\u6982\u5ff5\u6df7\u6dc6';
const CALCULATION_ERROR = '\u8ba1\u7b97\u9519\u8bef';
const OTHER_SUBJECT = '\u5176\u4ed6';
const UNCATEGORIZED_DECK = '\u672a\u5206\u7c7b\u9519\u9898';

const baseQuestion = {
  id: 'wq_1',
  subject: SUBJECT,
  category: CATEGORY,
  knowledgePoints: [KNOWLEDGE_POINT, CATEGORY],
  errorType: ERROR_TYPE,
  questionText: '\u8ba1\u7b97\u95ed\u5408\u66f2\u7ebf\u79ef\u5206\u3002',
  analysis: '\u7528\u683c\u6797\u516c\u5f0f\u3002',
  answer: '12',
  userNote: '',
};

describe('organizeWrongQuestion', () => {
  it('uses the first knowledge point as the deck name', () => {
    const result = organizeWrongQuestion({ wrongQuestion: baseQuestion, existingDecks: [] });

    expect(result.subjectKey).toBe(SUBJECT);
    expect(result.deckName).toBe(KNOWLEDGE_POINT);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.matchedDeckId).toBeUndefined();
  });

  it('reuses an existing deck when names overlap', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: baseQuestion,
      existingDecks: [
        { id: 'deck_1', name: KNOWLEDGE_POINT, nameLocked: false, keywords: [CATEGORY] },
      ],
    });

    expect(result.matchedDeckId).toBe('deck_1');
    expect(result.deckName).toBe(KNOWLEDGE_POINT);
    expect(result.reason).toContain('\u5df2\u6709\u4e13\u9898');
  });

  it('falls back to category when knowledge points are empty', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: { ...baseQuestion, knowledgePoints: [] },
      existingDecks: [],
    });

    expect(result.deckName).toBe(CATEGORY);
    expect(result.signals).toContain('category');
  });

  it('falls back to error type with lower confidence', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: {
        ...baseQuestion,
        knowledgePoints: [],
        category: '',
        errorType: CALCULATION_ERROR,
      },
      existingDecks: [],
    });

    expect(result.deckName).toBe(CALCULATION_ERROR);
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('uses other subject and system deck for thin records', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: {
        ...baseQuestion,
        subject: '',
        category: '',
        knowledgePoints: [],
        errorType: '',
      },
      existingDecks: [],
    });

    expect(result.subjectKey).toBe(OTHER_SUBJECT);
    expect(result.deckName).toBe(UNCATEGORIZED_DECK);
  });
});
