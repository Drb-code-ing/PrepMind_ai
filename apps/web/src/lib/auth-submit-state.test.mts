import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_AGREEMENT_REQUIRED_MESSAGE,
  getAuthAgreementError,
  isAuthSubmitDisabled,
} from './auth-submit-state.ts';

test('keeps auth submit clickable before agreement so validation feedback can appear', () => {
  assert.equal(isAuthSubmitDisabled({ submitting: false }), false);
});

test('disables auth submit only while a request is pending', () => {
  assert.equal(isAuthSubmitDisabled({ submitting: true }), true);
});

test('returns a stable agreement error before login or register submission', () => {
  assert.equal(getAuthAgreementError(false), AUTH_AGREEMENT_REQUIRED_MESSAGE);
  assert.equal(getAuthAgreementError(true), null);
});
