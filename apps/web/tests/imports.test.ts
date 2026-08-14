import { describe, expect, it } from 'vitest';
import { decodeUtf8, parseCanonicalCsv } from '../lib/imports/csv';
import { safeDatabaseError } from '../lib/imports/errors';
import { sha256Hex } from '../lib/imports/hash';
import { importStoragePath, sanitizeFilename } from '../lib/imports/storage';

describe('CSV ingestion boundary', () => {
  const orders = [
    'order_id,pharmacy_id,pharmacy_name,placed_at,product_id,product_name,manufacturer,requested_qty,unit',
    'ORD-1,PH-1,"Cairo, Main",2026-08-14T10:30:00Z,PROD-1,Medicine,,2,',
  ].join('\r\n');

  it('parses canonical quoted CSV and assigns source row numbers', () => {
    const rows = parseCanonicalCsv(orders, 'ORDERS');
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[0].values.pharmacy_name).toBe('Cairo, Main');
  });

  it('rejects reordered and extra headers', () => {
    expect(() => parseCanonicalCsv(orders.replace('order_id,pharmacy_id', 'pharmacy_id,order_id'), 'ORDERS')).toThrow();
    expect(() => parseCanonicalCsv(orders.replace('order_id,', 'extra,order_id,'), 'ORDERS')).toThrow();
  });

  it('accepts a UTF-8 BOM and rejects invalid UTF-8 bytes', () => {
    expect(parseCanonicalCsv(`\uFEFF${orders}`, 'ORDERS')).toHaveLength(1);
    expect(() => decodeUtf8(new Uint8Array([0xff, 0xfe]))).toThrow();
  });

  it('hashes bytes deterministically', () => {
    const bytes = new TextEncoder().encode(orders);
    expect(sha256Hex(bytes)).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Hex(bytes)).toBe(sha256Hex(bytes));
  });

  it('builds safe private paths', () => {
    expect(sanitizeFilename('../unsafe name.csv')).toBe('unsafe_name.csv');
    expect(importStoragePath('dataset', 'job', '../unsafe name.csv')).toBe(
      'imports/dataset/job/unsafe_name.csv'
    );
  });

  it('maps expected database failures without leaking internals', () => {
    expect(safeDatabaseError({ code: '23503', message: 'raw internal detail' })).toEqual({
      code: 'CROSS_DATASET_REFERENCE',
      message: 'A referenced record does not exist in this dataset.',
    });
  });
});
