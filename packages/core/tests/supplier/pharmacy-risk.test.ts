import { describe, expect, it } from 'vitest';
import { evaluatePharmacyServiceRisk } from '../../src/supplier/pharmacy-risk';

describe('pharmacy service risk', () => {
  it('does not call a pharmacy stable without evaluated fulfillment evidence', () => {
    const result = evaluatePharmacyServiceRisk('pharmacy-1', [], []);

    expect(result.serviceRiskLevel).toBe('INSUFFICIENT_DATA');
    expect(result.exceptionRateBps).toBeNull();
    expect(result.evaluatedOrders).toBe(0);
  });

  it('derives risk from evaluated orders and exceptions', () => {
    const result = evaluatePharmacyServiceRisk(
      'pharmacy-1',
      [{ orderId: 'order-1' }, { orderId: 'order-2' }, { orderId: 'order-3' }],
      [{ orderId: 'order-1', type: 'PARTIAL_FILL', severity: 'MEDIUM' }]
    );

    expect(result.serviceRiskLevel).toBe('AT_RISK');
    expect(result.exceptionRateBps).toBe(3333);
    expect(result.evaluatedOrders).toBe(3);
  });
});
