const ERROR_BOOK_PATH = '/error-book';

export function getWrongQuestionFocusHref(id: string | null | undefined) {
  const normalizedId = id?.trim();
  if (!normalizedId) return ERROR_BOOK_PATH;

  const search = new URLSearchParams({ focus: normalizedId });
  return `${ERROR_BOOK_PATH}?${search.toString()}`;
}

export function getWrongQuestionFocusId(searchParams: URLSearchParams | ReadonlyURLSearchParams) {
  const value = searchParams.get('focus')?.trim();
  return value || null;
}

type ReadonlyURLSearchParams = Pick<URLSearchParams, 'get'>;
