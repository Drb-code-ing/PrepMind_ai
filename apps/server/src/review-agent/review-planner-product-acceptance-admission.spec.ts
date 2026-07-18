import { createHash } from 'node:crypto';
import * as nodeCrypto from 'node:crypto';

import { createReviewPlannerProductAcceptanceAdmission } from './review-planner-product-acceptance-admission';

const capability = 'v8-product-acceptance-capability';
const capabilitySha256 = createHash('sha256')
  .update(capability, 'utf8')
  .digest('hex');

const validConfig = {
  enabled: true,
  serverRole: 'api',
  component: 'review',
  capabilitySha256,
  maxRequests: 2,
} as const;

describe('review planner product acceptance admission', () => {
  it('is default-off and rejects unconfigured or worker claims', () => {
    expect(
      createReviewPlannerProductAcceptanceAdmission({ enabled: false }).claim(
        'review',
        capability,
      ),
    ).toBe(false);
    expect(
      createReviewPlannerProductAcceptanceAdmission({
        enabled: true,
        serverRole: 'api',
      }).claim('review', capability),
    ).toBe(false);
    expect(
      createReviewPlannerProductAcceptanceAdmission({
        ...validConfig,
        serverRole: 'worker',
      }).claim('review', capability),
    ).toBe(false);
  });

  it('accepts exactly two matching claims and irreversibly rejects the third', () => {
    const admission =
      createReviewPlannerProductAcceptanceAdmission(validConfig);

    expect(admission.claim('review', capability)).toBe(true);
    expect(admission.claim('review', capability)).toBe(true);
    expect(admission.claim('review', capability)).toBe(false);
  });

  it('does not consume capacity for missing, wrong, or component-mismatched claims', () => {
    const admission =
      createReviewPlannerProductAcceptanceAdmission(validConfig);

    expect(admission.claim('review', undefined)).toBe(false);
    expect(admission.claim('review', 'wrong-capability')).toBe(false);
    expect(admission.claim('planner', capability)).toBe(false);
    expect(admission.claim('review', capability)).toBe(true);
    expect(admission.claim('review', capability)).toBe(true);
  });

  it('fails closed for malformed enabled configurations', () => {
    for (const config of [
      { ...validConfig, component: '' },
      { ...validConfig, capabilitySha256: capabilitySha256.toUpperCase() },
      { ...validConfig, capabilitySha256: '0'.repeat(63) },
      { ...validConfig, maxRequests: 0 },
      { ...validConfig, maxRequests: 1 },
      { ...validConfig, maxRequests: 3 },
    ]) {
      expect(
        createReviewPlannerProductAcceptanceAdmission(config).claim(
          'review',
          capability,
        ),
      ).toBe(false);
    }
  });

  it('keeps its public surface capability-free', () => {
    const admission =
      createReviewPlannerProductAcceptanceAdmission(validConfig);

    expect(Object.keys(admission)).toEqual(['claim']);
    expect(JSON.stringify(admission)).not.toContain(capability);
    expect(JSON.stringify(admission)).not.toContain(capabilitySha256);
  });

  it('atomically admits only two concurrent claim contenders', async () => {
    const admission =
      createReviewPlannerProductAcceptanceAdmission(validConfig);

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        Promise.resolve().then(() => admission.claim('review', capability)),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(2);
    expect(admission.claim('review', capability)).toBe(false);
  });

  it('uses fixed 32-byte timing-safe comparisons and rejects reentrant claims', () => {
    const actualTimingSafeEqual = nodeCrypto.timingSafeEqual;
    let nestedResult: boolean | undefined;
    const state: {
      admission?: ReturnType<
        typeof createReviewPlannerProductAcceptanceAdmission
      >;
    } = {};
    const compare = jest.fn(
      (left: NodeJS.ArrayBufferView, right: NodeJS.ArrayBufferView) => {
        nestedResult = state.admission?.claim('review', capability);
        return actualTimingSafeEqual(left, right);
      },
    );
    const admission = createReviewPlannerProductAcceptanceAdmission(
      validConfig,
      {
        timingSafeEqual: compare,
      },
    );
    state.admission = admission;

    expect(admission.claim('review', capability)).toBe(true);
    expect(nestedResult).toBe(false);
    expect(compare).toHaveBeenCalledTimes(1);
    const [left, right] = compare.mock.calls[0] ?? [];
    expect(left).toHaveLength(32);
    expect(right).toHaveLength(32);
  });
});
