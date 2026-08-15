import { describe, expect, it } from 'vitest';
import {
  generateMappedPreview,
  headerToSnakeCase,
  inferColumnMappings,
  matchHeaderToCanonical,
  normalizeHeader,
  validateColumnMapping,
} from '../../src/index';

describe('Flexible CSV Mapping Engine', () => {
  describe('Header Normalization', () => {
    it.each([
      ['Supplier Code', 'supplier code', 'supplier_code'],
      ['supplier-code', 'supplier code', 'supplier_code'],
      ['supplier_code', 'supplier code', 'supplier_code'],
      ['supplierCode', 'supplier code', 'supplier_code'],
      ['SUPPLIER CODE', 'supplier code', 'supplier_code'],
      ['  orderTimestamp  ', 'order timestamp', 'order_timestamp'],
      ['Unit-Price-EGP (incl VAT)', 'unit price egp incl vat', 'unit_price_egp_incl_vat'],
    ])('normalizes header %s correctly', (raw, expectedWords, expectedSnake) => {
      expect(normalizeHeader(raw)).toBe(expectedWords);
      expect(headerToSnakeCase(raw)).toBe(expectedSnake);
    });
  });

  describe('Header Matcher', () => {
    it('matches exact canonical headers with HIGH confidence', () => {
      const match = matchHeaderToCanonical('supplier_id', 'OFFERS');
      expect(match.confidence).toBe('HIGH');
      expect(match.targetField).toBe('supplier_id');
      expect(match.matchType).toBe('EXACT_CANONICAL');
    });

    it('matches known aliases with HIGH confidence', () => {
      const match = matchHeaderToCanonical('vendor_code', 'OFFERS');
      expect(match.confidence).toBe('HIGH');
      expect(match.targetField).toBe('supplier_id');
      expect(match.matchType).toBe('KNOWN_ALIAS');

      const matchSku = matchHeaderToCanonical('sku', 'ORDERS');
      expect(matchSku.confidence).toBe('HIGH');
      expect(matchSku.targetField).toBe('product_id');

      const matchDate = matchHeaderToCanonical('order_date', 'ORDERS');
      expect(matchDate.confidence).toBe('HIGH');
      expect(matchDate.targetField).toBe('placed_at');
    });

    it('handles camelCase and PascalCase variations', () => {
      const match1 = matchHeaderToCanonical('placedAt', 'ORDERS');
      expect(match1.targetField).toBe('placed_at');
      expect(match1.confidence).toBe('HIGH');

      const match2 = matchHeaderToCanonical('VendorCode', 'OFFERS');
      expect(match2.targetField).toBe('supplier_id');
      expect(match2.confidence).toBe('HIGH');
    });

    it('is aware of import type context', () => {
      const orderQty = matchHeaderToCanonical('qty_ordered', 'ORDERS');
      expect(orderQty.targetField).toBe('requested_qty');

      const offerQty = matchHeaderToCanonical('qty_available', 'OFFERS');
      expect(offerQty.targetField).toBe('available_qty');

      const outcomeQty = matchHeaderToCanonical('qty_delivered', 'OUTCOMES');
      expect(outcomeQty.targetField).toBe('filled_qty');
    });

    it('flags ambiguous generic terms as NEEDS_REVIEW', () => {
      const ambiguousQuantity = matchHeaderToCanonical('quantity', 'ORDERS');
      expect(ambiguousQuantity.confidence).toBe('NEEDS_REVIEW');
      expect(ambiguousQuantity.matchType).toBe('AMBIGUOUS');
      expect(ambiguousQuantity.targetField).toBe('requested_qty');

      const ambiguousId = matchHeaderToCanonical('id', 'ORDERS');
      expect(ambiguousId.confidence).toBe('NEEDS_REVIEW');
      expect(ambiguousId.alternateCandidates?.length).toBeGreaterThan(1);
    });

    it('produces MEDIUM confidence for strong fuzzy matches', () => {
      const fuzzy = matchHeaderToCanonical('supplr_name', 'OFFERS');
      expect(fuzzy.targetField).toBe('supplier_name');
      expect(fuzzy.confidence).toBe('MEDIUM');
    });

    it('returns UNMAPPED for non-matching headers', () => {
      const unmapped = matchHeaderToCanonical('totally_unknown_custom_column_xyz', 'ORDERS');
      expect(unmapped.targetField).toBeNull();
      expect(unmapped.confidence).toBe('UNMAPPED');
    });
  });

  describe('Mapping Validation', () => {
    it('validates a complete mapping correctly', () => {
      const mapping = {
        order_number: 'order_id',
        pharmacy_code: 'pharmacy_id',
        pharmacy_title: 'pharmacy_name',
        order_timestamp: 'placed_at',
        sku: 'product_id',
        item_title: 'product_name',
        mfg: 'manufacturer',
        qty_ordered: 'requested_qty',
        uom: 'unit',
      };
      const validation = validateColumnMapping(mapping, 'ORDERS');
      expect(validation.isValid).toBe(true);
      expect(validation.missingRequiredFields).toHaveLength(0);
      expect(validation.duplicateTargetFields).toHaveLength(0);
      expect(validation.requiredMapped).toBe(6);
    });

    it('flags missing required fields', () => {
      const mapping = {
        order_number: 'order_id',
        pharmacy_code: 'pharmacy_id',
        sku: 'product_id',
        // missing: placed_at, product_name, requested_qty
      };
      const validation = validateColumnMapping(mapping, 'ORDERS');
      expect(validation.isValid).toBe(false);
      expect(validation.missingRequiredFields).toContain('placed_at');
      expect(validation.missingRequiredFields).toContain('product_name');
      expect(validation.missingRequiredFields).toContain('requested_qty');
    });

    it('flags duplicate target mappings', () => {
      const mapping = {
        col1: 'product_id',
        col2: 'product_id', // duplicate
        order_id: 'order_id',
        pharmacy_id: 'pharmacy_id',
        placed_at: 'placed_at',
        product_name: 'product_name',
        requested_qty: 'requested_qty',
      };
      const validation = validateColumnMapping(mapping, 'ORDERS');
      expect(validation.isValid).toBe(false);
      expect(validation.duplicateTargetFields).toContain('product_id');
    });

    it('allows ignored columns with null target', () => {
      const mapping = {
        order_id: 'order_id',
        pharmacy_id: 'pharmacy_id',
        placed_at: 'placed_at',
        product_id: 'product_id',
        product_name: 'product_name',
        requested_qty: 'requested_qty',
        random_notes: null, // ignored
      };
      const validation = validateColumnMapping(mapping, 'ORDERS');
      expect(validation.isValid).toBe(true);
      expect(validation.ignoredFieldsCount).toBe(1);
    });
  });

  describe('Full Inference Engine & Preview', () => {
    it('infers mappings across headers and generates live preview rows', () => {
      const headers = ['Order Number', 'Branch Code', 'Order Date', 'SKU Code', 'Drug Name', 'Quantity', 'Internal Notes'];
      const mappings = inferColumnMappings(headers, 'ORDERS');
      expect(mappings).toHaveLength(7);

      const orderNumber = mappings.find((m) => m.sourceHeader === 'Order Number');
      expect(orderNumber?.targetField).toBe('order_id');
      expect(orderNumber?.confidence).toBe('HIGH');

      const branchCode = mappings.find((m) => m.sourceHeader === 'Branch Code');
      expect(branchCode?.targetField).toBe('pharmacy_id');

      const skuCode = mappings.find((m) => m.sourceHeader === 'SKU Code');
      expect(skuCode?.targetField).toBe('product_id');

      const sampleRows = [
        {
          rowNumber: 2,
          values: {
            'Order Number': 'ORD-999',
            'Branch Code': 'PHARM-01',
            'Order Date': '2026-08-10T10:00:00Z',
            'SKU Code': 'SKU-500',
            'Drug Name': 'Panadol Extra 500mg',
            Quantity: '50',
            'Internal Notes': 'Urgent shipment',
          },
        },
      ];

      const mappingSpec: Record<string, string | null> = {
        'Order Number': 'order_id',
        'Branch Code': 'pharmacy_id',
        'Order Date': 'placed_at',
        'SKU Code': 'product_id',
        'Drug Name': 'product_name',
        Quantity: 'requested_qty',
        'Internal Notes': null,
      };

      const preview = generateMappedPreview(sampleRows, mappingSpec, 'ORDERS');
      expect(preview.totalSampleRows).toBe(1);
      expect(preview.validSampleRows).toBe(1);
      expect(preview.previewRows[0].canonicalValues).toEqual({
        order_id: 'ORD-999',
        pharmacy_id: 'PHARM-01',
        placed_at: '2026-08-10T10:00:00Z',
        product_id: 'SKU-500',
        product_name: 'Panadol Extra 500mg',
        requested_qty: '50',
      });
    });
  });
});
