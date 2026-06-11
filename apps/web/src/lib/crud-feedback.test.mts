import assert from 'node:assert/strict';

import {
  getDeleteConfirmButtonClassName,
  getCrudSuccessMessage,
  getDeleteActionState,
  shouldForwardCrudNotice,
  type DeleteActionInput,
} from './crud-feedback.ts';

function run() {
  testBuildsSuccessMessages();
  testResolvesDeleteActionState();
  testKeepsDangerButtonTextVisible();
  testScopesCrudNotices();
}

function testBuildsSuccessMessages() {
  assert.equal(getCrudSuccessMessage('错题', 'create'), '错题已创建');
  assert.equal(getCrudSuccessMessage('错题', 'update'), '错题已更新');
  assert.equal(getCrudSuccessMessage('错题', 'delete'), '错题已删除');
  assert.equal(getCrudSuccessMessage('备注', 'save'), '备注已保存');
}

function testResolvesDeleteActionState() {
  const base: DeleteActionInput = {
    itemId: 'wrong_1',
    pendingDeleteId: null,
    deletingId: null,
  };

  assert.equal(getDeleteActionState(base), 'idle');
  assert.equal(getDeleteActionState({ ...base, pendingDeleteId: 'wrong_1' }), 'confirming');
  assert.equal(getDeleteActionState({ ...base, deletingId: 'wrong_1' }), 'deleting');
  assert.equal(
    getDeleteActionState({ ...base, pendingDeleteId: 'wrong_2', deletingId: 'wrong_2' }),
    'idle',
  );
}

function testKeepsDangerButtonTextVisible() {
  assert.match(getDeleteConfirmButtonClassName(), /\btext-white\b/);
}

function testScopesCrudNotices() {
  assert.equal(shouldForwardCrudNotice('page'), true);
  assert.equal(shouldForwardCrudNotice('detail'), false);
}

run();
