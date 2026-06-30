type SafetyRiskLevel = 'medium' | 'high';

export type RagSafetyCategory =
  | 'instruction_override'
  | 'secret_exfiltration'
  | 'tool_or_data_write'
  | 'deception_or_hidden_behavior'
  | 'identity_or_policy_claim';

export type RagSafetyClassification = {
  riskLevel: 'low' | 'medium' | 'high';
  categories: RagSafetyCategory[];
  matchedPatterns: string[];
  safeForPrompt: boolean;
};

type SafetyPattern = {
  id: string;
  category: RagSafetyCategory;
  riskLevel: SafetyRiskLevel;
  pattern: RegExp;
};

const safetyPatterns: SafetyPattern[] = [
  {
    id: 'ignore_previous_instructions_zh',
    category: 'instruction_override',
    riskLevel: 'high',
    pattern: /(忽略|蹇界暐).{0,30}(之前|以上|所有|涔嬪墠|浠ヤ笂|鎵€鏈?).{0,30}(指令|规则|提示|鎸囦护|寚浠|瑙勫垯|鎻愮ず)/i,
  },
  {
    id: 'ignore_previous_instructions_en',
    category: 'instruction_override',
    riskLevel: 'high',
    pattern: /ignore (previous|all|above).{0,20}(instruction|prompt|rule)s?/i,
  },
  {
    id: 'secret_exfiltration',
    category: 'secret_exfiltration',
    riskLevel: 'high',
    pattern:
      /(泄露|输出|显示|娉勯湶|杈撳嚭|緭鍑|鏄剧ず|print|reveal|show).{0,32}(api key|token|密钥|系统提示|瀵嗛挜|绯荤粺鎻愮ず|绯荤粺|system prompt|cookie)/i,
  },
  {
    id: 'hidden_behavior',
    category: 'deception_or_hidden_behavior',
    riskLevel: 'high',
    pattern:
      /(不要|不得|涓嶈|涓嶅緱|笉瑕|do not).{0,16}(告诉|提醒|鍛婅瘔|鎻愰啋|憡璇|tell|warn).{0,16}(用户|鐢ㄦ埛|敤鎴|user)/i,
  },
  {
    id: 'tool_or_data_write',
    category: 'tool_or_data_write',
    riskLevel: 'high',
    pattern:
      /(删除|修改|替换|创建|鍒犻櫎|淇敼|鏇挎崲|鍒涘缓|delete|modify|replace|create).{0,20}(资料|记忆|计划|数据库|璧勬枡|璁板繂|璁″垝|鏁版嵁搴搢document|memory|database|plan)/i,
  },
  {
    id: 'call_tool_or_function',
    category: 'tool_or_data_write',
    riskLevel: 'high',
    pattern: /call .{0,20}(tool|function|api)/i,
  },
  {
    id: 'system_priority_claim',
    category: 'identity_or_policy_claim',
    riskLevel: 'medium',
    pattern:
      /(系统|开发者|最高优先级|绯荤粺|寮€鍙戣€|鏈€楂樹紭鍏堢骇|system|developer).{0,24}(指令|消息|规则|鎸囦护|娑堟伅|瑙勫垯|instruction|message|rule)/i,
  },
  {
    id: 'assistant_identity_claim',
    category: 'identity_or_policy_claim',
    riskLevel: 'medium',
    pattern: /(你是|浣犳槸|you are).{0,20}(chatgpt|assistant|system|助手|绯荤粺)/i,
  },
];

export function classifyRagChunkSafety(text: string): RagSafetyClassification {
  const categories = new Set<RagSafetyCategory>();
  const matchedPatterns: string[] = [];
  let hasHighRisk = false;
  let hasMediumRisk = false;

  for (const item of safetyPatterns) {
    if (!item.pattern.test(text)) {
      continue;
    }

    categories.add(item.category);
    matchedPatterns.push(item.id);
    hasHighRisk ||= item.riskLevel === 'high';
    hasMediumRisk ||= item.riskLevel === 'medium';
  }

  const riskLevel = hasHighRisk ? 'high' : hasMediumRisk ? 'medium' : 'low';

  return {
    riskLevel,
    categories: [...categories],
    matchedPatterns,
    safeForPrompt: riskLevel !== 'high',
  };
}
