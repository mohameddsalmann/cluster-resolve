import { describe, expect, it } from 'vitest';
import {
  canonicalFieldMetadata,
  mappingConfidenceSchema,
  mappingSpecificationSchema,
} from '../src/index';

describe('Mapping Schemas', () => {
  it('validates confidence enum values', () => {
    expect(mappingConfidenceSchema.safeParse('HIGH').success).toBe(true);
    expect(mappingConfidenceSchema.safeParse('MEDIUM').success).toBe(true);
    expect(mappingConfidenceSchema.safeParse('NEEDS_REVIEW').success).toBe(true);
    expect(mappingConfidenceSchema.safeParse('UNMAPPED').success).toBe(true);
    expect(mappingConfidenceSchema.safeParse('UNKNOWN').success).toBe(false);
  });

  it('validates mapping specifications', () => {
    const valid = {
      vendor_code: 'supplier_id',
      sku: 'product_id',
      notes: null,
    };
    expect(mappingSpecificationSchema.safeParse(valid).success).toBe(true);
  });

  it('contains canonical metadata for all four import kinds', () => {
    for (const kind of ['ORDERS', 'OFFERS', 'OUTCOMES', 'DECISIONS'] as const) {
      const meta = canonicalFieldMetadata[kind];
      expect(meta).toBeDefined();
      expect(Object.keys(meta).length).toBeGreaterThan(0);
      const required = Object.values(meta).filter((f) => f.required);
      expect(required.length).toBeGreaterThan(0);
    }
  });
});
