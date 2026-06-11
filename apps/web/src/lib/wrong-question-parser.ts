const HEADING_ALIASES = {
  recognitionResult: ['识别结果', '类型', '内容类型'],
  questionText: ['题目', '题干', '完整题目'],
  subject: ['学科', '科目'],
  knowledgePoints: ['知识点', '考点'],
  analysis: ['分析思路', '解析', '解题思路', '分析'],
  answer: ['参考答案', '答案', '正确答案'],
  errorType: ['错因建议', '错因', '错误原因'],
} as const;

export const WRONG_QUESTION_REQUIRED_FIELDS = [
  'questionText',
  'knowledgePoints',
  'analysis',
  'answer',
] as const;

export const OCR_WRONG_QUESTION_MARKDOWN_SCHEMA = `## 识别结果
只能输出一个值：题目 / 非题目。

## 题目
完整题干。多题时用（1）（2）分段，但仍放在本节内。

## 学科
只能输出一个值：数学 / 英语 / 物理 / 化学 / 生物 / 计算机 / 其他。

## 知识点
- 至少 1 个核心知识点
- 可补充相关章节或概念

## 分析思路
分步骤解释关键推理过程，避免只给结论。

## 参考答案
给出最终答案，并保留必要计算或依据。

## 错因建议
只能优先输出一个值：概念不清 / 审题错误 / 计算错误 / 方法不会 / 记忆遗漏 / 其他。`;

export interface ParsedWrongQuestion {
  isQuestion: boolean;
  questionText: string;
  subject: string;
  category: string;
  knowledgePoints: string[];
  analysis: string;
  answer: string;
  errorType: string;
  rawContent: string;
}

type RequiredWrongQuestionField = (typeof WRONG_QUESTION_REQUIRED_FIELDS)[number];

export type OcrResultStatus = 'streaming' | 'done' | 'failed' | 'aborted';

export function formatOcrContentForDisplay(content: string) {
  return content
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/([；;。])\s*(\(\d+\))/g, '$1\n\n$2')
    .replace(/\s*(\(\d+\))\s*/g, '\n\n### $1 ')
    .replace(/。\s*(解释[:：])/g, '。\n\n**$1**')
    .replace(/。\s*(分析[:：])/g, '。\n\n**$1**')
    .replace(/。\s*(答案[:：])/g, '。\n\n**$1**')
    .replace(/。\s*(但需注意)/g, '。\n\n$1')
    .replace(/。\s*(因此|由此|故|所以)/g, '。\n\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeHeading(text: string) {
  return text
    .replace(/[#：:]/g, '')
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]/gu, '')
    .trim();
}

function normalizeSectionContent(text: string) {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function extractSections(content: string) {
  const sections = new Map<string, string>();
  const headingRegex = /^#{2,3}\s*(.+?)\s*$/gm;
  const matches = [...content.matchAll(headingRegex)];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const next = matches[i + 1];
    const title = normalizeHeading(match[1] ?? '');
    const start = (match.index ?? 0) + match[0].length;
    const end = next?.index ?? content.length;
    sections.set(title, normalizeSectionContent(content.slice(start, end)));
  }

  return sections;
}

function pickSection(sections: Map<string, string>, aliases: readonly string[], fallback = '') {
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeading(alias);
    const exact = sections.get(normalizedAlias);
    if (exact) return exact;

    for (const [heading, value] of sections) {
      if (heading.includes(normalizedAlias) && value) return value;
    }
  }
  return fallback;
}

function parseList(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.、\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function inferSubject(text: string) {
  const lower = text.toLowerCase();
  if (/函数|方程|几何|概率|导数|数列|代数|数学/.test(text)) return '数学';
  if (/英语|单词|语法|阅读|作文|translation|grammar|vocabulary/.test(lower)) return '英语';
  if (/物理|力学|电路|电场|磁场|速度|加速度/.test(text)) return '物理';
  if (/化学|反应|离子|元素|方程式|溶液/.test(text)) return '化学';
  if (/生物|细胞|遗传|生态|蛋白质/.test(text)) return '生物';
  if (/算法|代码|编程|数据库|网络|操作系统|计算机/.test(text)) return '计算机';
  return '其他';
}

function inferErrorType(text: string) {
  if (/审题|题意|条件/.test(text)) return '审题错误';
  if (/计算|运算|符号|化简/.test(text)) return '计算错误';
  if (/概念|定义|原理/.test(text)) return '概念不清';
  if (/方法|思路|不会|步骤/.test(text)) return '方法不会';
  if (/记忆|公式|背诵/.test(text)) return '记忆遗漏';
  return '其他';
}

function isUnknownValue(text: string) {
  const normalized = text.trim();
  return !normalized || /^未识别/.test(normalized);
}

function inferIsQuestion({
  recognitionResult,
  questionText,
  subject,
  knowledgePoints,
  analysis,
  answer,
  rawContent,
}: {
  recognitionResult: string;
  questionText: string;
  subject: string;
  knowledgePoints: string[];
  analysis: string;
  answer: string;
  rawContent: string;
}) {
  const marker = recognitionResult.split('\n')[0]?.trim() ?? '';
  const inspectionText = [marker, questionText, analysis].join('\n');

  if (/非题目|不是题目|未识别到题目|无题目内容|没有题目|不包含.*题目/.test(inspectionText)) {
    return false;
  }

  if (/^题目$|^是题目$|考试题目|练习题/.test(marker)) {
    return true;
  }

  const allFieldsUnknown =
    isUnknownValue(subject) &&
    isUnknownValue(answer) &&
    (knowledgePoints.length === 0 || knowledgePoints.every(isUnknownValue));
  if (allFieldsUnknown && /照片|图片|人像|风景|截图|不是.*题目|未包含.*题目/.test(rawContent)) {
    return false;
  }

  return true;
}

export function parseOcrResult(content: string): ParsedWrongQuestion {
  const rawContent = content.trim();
  const sections = extractSections(rawContent);
  const recognitionResult = pickSection(sections, HEADING_ALIASES.recognitionResult);
  const questionText = pickSection(sections, HEADING_ALIASES.questionText, rawContent);
  const analysis = pickSection(sections, HEADING_ALIASES.analysis);
  const answer = pickSection(sections, HEADING_ALIASES.answer);
  const subjectText = pickSection(sections, HEADING_ALIASES.subject);
  const knowledgePointText = pickSection(sections, HEADING_ALIASES.knowledgePoints);
  const errorTypeText = pickSection(sections, HEADING_ALIASES.errorType);
  const knowledgePoints = parseList(knowledgePointText);
  const subject =
    subjectText
      .split('\n')[0]
      ?.replace(/^[-*•\s]+/, '')
      .trim() || inferSubject(rawContent);

  return {
    isQuestion: inferIsQuestion({
      recognitionResult,
      questionText,
      subject,
      knowledgePoints,
      analysis,
      answer,
      rawContent,
    }),
    questionText,
    subject,
    category: knowledgePoints[0] ?? subject,
    knowledgePoints,
    analysis,
    answer,
    errorType:
      errorTypeText
        .split('\n')[0]
        ?.replace(/^[-*•\s]+/, '')
        .trim() || inferErrorType(rawContent),
    rawContent,
  };
}

export function getMissingWrongQuestionFields(parsed: ParsedWrongQuestion) {
  const missing: RequiredWrongQuestionField[] = [];
  if (isUnknownValue(parsed.questionText)) missing.push('questionText');
  if (parsed.knowledgePoints.length === 0 || parsed.knowledgePoints.every(isUnknownValue)) {
    missing.push('knowledgePoints');
  }
  if (isUnknownValue(parsed.analysis)) missing.push('analysis');
  if (isUnknownValue(parsed.answer)) missing.push('answer');
  return missing;
}

export function canSaveOcrResult(parsed: ParsedWrongQuestion, status: OcrResultStatus) {
  return status === 'done' && parsed.isQuestion && getMissingWrongQuestionFields(parsed).length === 0;
}
