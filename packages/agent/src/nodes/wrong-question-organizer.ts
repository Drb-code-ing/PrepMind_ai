export type WrongQuestionOrganizerInput = {
  wrongQuestion: {
    id: string;
    subject?: string | null;
    category?: string | null;
    knowledgePoints?: readonly string[] | null;
    errorType?: string | null;
    questionText?: string | null;
    analysis?: string | null;
    answer?: string | null;
    userNote?: string | null;
  };
  existingDecks?: readonly WrongQuestionOrganizerExistingDeck[];
};

export type WrongQuestionOrganizerExistingDeck = {
  id: string;
  name: string;
  nameLocked?: boolean;
  keywords?: readonly string[];
};

export type WrongQuestionOrganizerResult = {
  subjectKey: string;
  subjectDisplayName: string;
  deckName: string;
  deckDescription: string;
  matchedDeckId?: string;
  reason: string;
  confidence: number;
  signals: string[];
};

type PrimarySignal = 'knowledgePoint' | 'category' | 'errorType' | 'fallback';

const OTHER_SUBJECT = '\u5176\u4ed6';
const UNCATEGORIZED_DECK = '\u672a\u5206\u7c7b\u9519\u9898';

export function organizeWrongQuestion({
  wrongQuestion,
  existingDecks = [],
}: WrongQuestionOrganizerInput): WrongQuestionOrganizerResult {
  const subjectKey = normalizeLabel(wrongQuestion.subject) || OTHER_SUBJECT;
  const knowledgePoint = firstUsefulLabel(wrongQuestion.knowledgePoints ?? []);
  const category = normalizeLabel(wrongQuestion.category);
  const errorType = normalizeLabel(wrongQuestion.errorType);
  const primarySignal = selectPrimarySignal({ knowledgePoint, category, errorType });
  const candidateDeckName = selectCandidateDeckName({
    knowledgePoint,
    category,
    errorType,
  });
  const matchedDeck = findMatchingDeck(candidateDeckName, existingDecks);
  const deckName = normalizeLabel(matchedDeck?.name) || candidateDeckName;
  const signals = collectSignals({
    knowledgePoint,
    category,
    errorType,
    matchedDeck: Boolean(matchedDeck),
  });

  return {
    subjectKey,
    subjectDisplayName: subjectKey,
    deckName,
    deckDescription: buildDeckDescription(subjectKey, deckName),
    matchedDeckId: matchedDeck?.id,
    reason: buildReason({ deckName, matchedDeckName: matchedDeck?.name, primarySignal }),
    confidence: calculateConfidence({
      hasKnowledgePoint: Boolean(knowledgePoint),
      hasCategory: Boolean(category),
      hasErrorType: Boolean(errorType),
      matchedDeck: Boolean(matchedDeck),
    }),
    signals,
  };
}

function normalizeLabel(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function firstUsefulLabel(values: readonly string[]) {
  return values.map((value) => normalizeLabel(value)).find(Boolean) ?? '';
}

function selectPrimarySignal(input: {
  knowledgePoint: string;
  category: string;
  errorType: string;
}): PrimarySignal {
  if (input.knowledgePoint) return 'knowledgePoint';
  if (input.category) return 'category';
  if (input.errorType) return 'errorType';
  return 'fallback';
}

function selectCandidateDeckName(input: {
  knowledgePoint: string;
  category: string;
  errorType: string;
}) {
  return input.knowledgePoint || input.category || input.errorType || UNCATEGORIZED_DECK;
}

function collectSignals(input: {
  knowledgePoint: string;
  category: string;
  errorType: string;
  matchedDeck: boolean;
}) {
  const signals: string[] = [];

  if (input.knowledgePoint) signals.push('knowledgePoint');
  if (input.category) signals.push('category');
  if (input.errorType) signals.push('errorType');
  if (!input.knowledgePoint && !input.category && !input.errorType) {
    signals.push('fallback');
  }
  if (input.matchedDeck) signals.push('existingDeck');

  return signals;
}

function findMatchingDeck(
  candidateName: string,
  decks: readonly WrongQuestionOrganizerExistingDeck[],
) {
  const normalizedCandidate = normalizeForMatch(candidateName);
  if (!normalizedCandidate) return undefined;

  return decks.find((deck) => {
    if (labelsOverlap(normalizeForMatch(deck.name), normalizedCandidate)) {
      return true;
    }

    return deck.keywords?.some((keyword) =>
      labelsOverlap(normalizeForMatch(keyword), normalizedCandidate),
    );
  });
}

function labelsOverlap(left: string, right: string) {
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function normalizeForMatch(value: string) {
  return normalizeLabel(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function calculateConfidence(input: {
  hasKnowledgePoint: boolean;
  hasCategory: boolean;
  hasErrorType: boolean;
  matchedDeck: boolean;
}) {
  let confidence = 0.35;

  if (input.hasKnowledgePoint) {
    confidence = 0.76;
    if (input.hasCategory) confidence += 0.06;
    if (input.hasErrorType) confidence += 0.04;
  } else if (input.hasCategory) {
    confidence = input.hasErrorType ? 0.72 : 0.68;
  } else if (input.hasErrorType) {
    confidence = 0.58;
  }

  if (input.matchedDeck) confidence += 0.04;

  return Math.min(0.95, Number(confidence.toFixed(2)));
}

function buildDeckDescription(subjectDisplayName: string, deckName: string) {
  return `\u7528\u4e8e\u6574\u7406${subjectDisplayName}\u4e2d\u7684${deckName}\u76f8\u5173\u9519\u9898\u3002`;
}

function buildReason(input: {
  deckName: string;
  matchedDeckName?: string;
  primarySignal: PrimarySignal;
}) {
  const matchedDeckName = normalizeLabel(input.matchedDeckName);
  if (matchedDeckName) {
    return `\u5df2\u6709\u4e13\u9898\u300c${matchedDeckName}\u300d\u4e0e\u5f53\u524d\u9519\u9898\u4fe1\u53f7\u91cd\u5408\uff0c\u7ee7\u7eed\u5f52\u5165\u8be5\u4e13\u9898\u3002`;
  }

  return `\u6839\u636e${describePrimarySignal(input.primarySignal)}\u5f52\u5165\u300c${input.deckName}\u300d\u3002`;
}

function describePrimarySignal(signal: PrimarySignal) {
  if (signal === 'knowledgePoint') return '\u77e5\u8bc6\u70b9';
  if (signal === 'category') return '\u9898\u76ee\u5206\u7c7b';
  if (signal === 'errorType') return '\u9519\u56e0\u7c7b\u578b';
  return '\u9ed8\u8ba4\u5206\u7c7b';
}
