export const AUTH_AGREEMENT_REQUIRED_MESSAGE = '请先同意用户协议和隐私政策';

export function getAuthAgreementError(agreed: boolean): string | null {
  return agreed ? null : AUTH_AGREEMENT_REQUIRED_MESSAGE;
}

export function isAuthSubmitDisabled({
  submitting,
}: {
  submitting: boolean;
}): boolean {
  return submitting;
}
