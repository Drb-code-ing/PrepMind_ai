export function shouldHandleReviewSuggestionLocally({
  actionHref,
  hasPrimaryAction,
}: {
  actionHref: string;
  hasPrimaryAction: boolean;
}) {
  return hasPrimaryAction && actionHref === '/today';
}

export function shouldShowTodayReviewEmptyNotice({
  hasPendingReviewTask,
  taskQuerySucceeded,
}: {
  hasPendingReviewTask: boolean;
  taskQuerySucceeded: boolean;
}) {
  return !hasPendingReviewTask && taskQuerySucceeded;
}

export function getTodayReviewTaskReadState({
  isLoading,
  isError,
  isSuccess,
}: {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}) {
  if (isLoading) return 'loading';
  if (isError) return 'error';
  return isSuccess ? 'ready' : 'unavailable';
}
