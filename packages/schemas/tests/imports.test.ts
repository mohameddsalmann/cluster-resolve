import { describe, expect, it } from 'vitest';
import { importHeaders, offerImportRowSchema, orderImportRowSchema } from '../src/imports';

describe('canonical import schemas', () => {
  it('publishes stable canonical headers', () => {
    expect(importHeaders.ORDERS[0]).toBe('order_id');
    expect(importHeaders.DECISIONS).not.toContain('candidate_id');
  });

  it('requires positive requested quantities', () => {
    const row = Object.fromEntries(importHeaders.ORDERS.map((header) => [header, 'x']));
    row.requested_qty = '0';
    expect(orderImportRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejects money with more than two decimal places', () => {
    const row = Object.fromEntries(importHeaders.OFFERS.map((header) => [header, 'x']));
    row.available_qty = '1';
    row.discount_percent = '';
    row.unit_price_egp = '12.555';
    expect(offerImportRowSchema.safeParse(row).success).toBe(false);
  });
});
