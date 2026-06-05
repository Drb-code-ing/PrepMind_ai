export interface Question {
  id: string;
  content: string;
  imageUrl: string | null;
  answer: string | null;
  analysis: string | null;
  knowledgePoints: string[];
  difficulty: number | null;
  source: string | null;
  createdAt: Date;
  userId: string;
}

export interface WrongQuestion {
  id: string;
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  errorReason: string | null;
  correctedAt: Date | null;
  createdAt: Date;
  userId: string;
}
