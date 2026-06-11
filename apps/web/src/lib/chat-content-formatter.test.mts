import assert from 'node:assert/strict';
import test from 'node:test';

import { formatChatAssistantContent } from './chat-content-formatter.ts';

test('normalizes bracketed display math into markdown math blocks', () => {
  const formatted = formatChatAssistantContent(
    String.raw`公式是：\[ \oint_L P dx + Q dy = \iint_D \left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dA \]`,
  );

  assert.equal(
    formatted,
    String.raw`公式是：

$$
\oint_L P dx + Q dy = \iint_D \left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dA
$$`,
  );
});

test('normalizes plain bracketed latex after formula labels', () => {
  const formatted = formatChatAssistantContent(
    String.raw`公式是：[ \oint_L P dx + Q dy = \iint_D 0 dA ]`,
  );

  assert.equal(
    formatted,
    String.raw`公式是：

$$
\oint_L P dx + Q dy = \iint_D 0 dA
$$`,
  );
});

test('separates compact numbered steps into readable blocks', () => {
  const formatted = formatChatAssistantContent(
    '步骤1：检查路径。步骤2：添加辅助线。步骤3：使用格林公式。',
  );

  assert.equal(
    formatted,
    '**步骤 1：** 检查路径。\n\n**步骤 2：** 添加辅助线。\n\n**步骤 3：** 使用格林公式。',
  );
});
