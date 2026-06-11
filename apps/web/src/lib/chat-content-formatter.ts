function normalizeDisplayMath(content: string) {
  return content
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, math: string) => {
      return `\n\n$$\n${math.trim()}\n$$\n\n`;
    })
    .replace(/(公式(?:是|为)?[：:])\s*\[\s*([^\]]*\\[a-zA-Z][^\]]*)\s*\]/g, (_, label: string, math: string) => {
      return `${label}\n\n$$\n${math.trim()}\n$$`;
    });
}

function normalizeInlineMath(content: string) {
  return content.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, math: string) => `$${math.trim()}$`);
}

function normalizeCompactSteps(content: string) {
  return content.replace(
    /(?:^|\s*)步骤\s*(\d+)\s*[：:]\s*/g,
    (match: string, step: string, offset: number) => {
      const prefix = offset === 0 ? '' : '\n\n';
      return `${prefix}**步骤 ${step}：** `;
    },
  );
}

export function formatChatAssistantContent(content: string) {
  return normalizeCompactSteps(normalizeInlineMath(normalizeDisplayMath(content)))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
