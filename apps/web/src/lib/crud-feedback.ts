export type CrudAction = 'create' | 'update' | 'delete' | 'save';
export type DeleteActionState = 'idle' | 'confirming' | 'deleting';
export type CrudNoticeScope = 'page' | 'detail';

export type DeleteActionInput = {
  itemId: string;
  pendingDeleteId: string | null;
  deletingId: string | null;
};

const actionLabels: Record<CrudAction, string> = {
  create: '已创建',
  update: '已更新',
  delete: '已删除',
  save: '已保存',
};

export function getCrudSuccessMessage(resourceName: string, action: CrudAction) {
  return `${resourceName}${actionLabels[action]}`;
}

export function getDeleteActionState({
  itemId,
  pendingDeleteId,
  deletingId,
}: DeleteActionInput): DeleteActionState {
  if (deletingId === itemId) return 'deleting';
  if (pendingDeleteId === itemId) return 'confirming';
  return 'idle';
}

export function getDeleteConfirmButtonClassName() {
  return 'min-h-11 rounded-md bg-destructive text-xs font-medium text-white transition-colors active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground';
}

export function shouldForwardCrudNotice(scope: CrudNoticeScope) {
  return scope === 'page';
}
