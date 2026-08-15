import { z } from 'zod';
import { type ImportKind } from './imports';

export const mappingConfidenceLevels = ['HIGH', 'MEDIUM', 'NEEDS_REVIEW', 'UNMAPPED'] as const;
export const mappingConfidenceSchema = z.enum(mappingConfidenceLevels);
export type MappingConfidence = z.infer<typeof mappingConfidenceSchema>;

export interface ColumnMappingCandidate {
  targetField: string | null; // null means ignore
  confidence: MappingConfidence;
  matchType: 'EXACT_CANONICAL' | 'KNOWN_ALIAS' | 'FUZZY_MATCH' | 'AMBIGUOUS' | 'IGNORED' | 'UNMAPPED';
  reason?: string;
  alternateCandidates?: string[];
}

export interface SourceColumnMapping extends ColumnMappingCandidate {
  sourceHeader: string;
  sampleValues: string[];
}

export const mappingSpecificationSchema = z.record(z.string(), z.string().nullable());
export type MappingSpecification = z.infer<typeof mappingSpecificationSchema>;

export interface MappingValidationResult {
  isValid: boolean;
  importKind: ImportKind;
  requiredMapped: number;
  requiredTotal: number;
  missingRequiredFields: string[];
  duplicateTargetFields: string[];
  mappedFieldsCount: number;
  ignoredFieldsCount: number;
  unmappedFieldsCount: number;
}

export const canonicalFieldMetadata: Record<
  ImportKind,
  Record<string, { required: boolean; description: string; type: 'string' | 'integer' | 'money' | 'percentage' | 'timestamp' | 'boolean' }>
> = {
  ORDERS: {
    order_id: { required: true, description: 'Unique identifier for the order', type: 'string' },
    pharmacy_id: { required: true, description: 'Unique identifier for the purchasing pharmacy', type: 'string' },
    pharmacy_name: { required: false, description: 'Name of the purchasing pharmacy', type: 'string' },
    placed_at: { required: true, description: 'ISO timestamp when order was placed', type: 'timestamp' },
    product_id: { required: true, description: 'Unique identifier for the requested SKU/product', type: 'string' },
    product_name: { required: true, description: 'Name or description of the product', type: 'string' },
    manufacturer: { required: false, description: 'Manufacturer or pharmaceutical brand', type: 'string' },
    requested_qty: { required: true, description: 'Positive integer quantity requested', type: 'integer' },
    unit: { required: false, description: 'Unit of measure (e.g. pack, bottle, box)', type: 'string' },
  },
  OFFERS: {
    offer_id: { required: true, description: 'Unique identifier for the supplier quote/offer', type: 'string' },
    order_id: { required: true, description: 'Associated order identifier', type: 'string' },
    supplier_id: { required: true, description: 'Unique identifier for the quoting supplier', type: 'string' },
    supplier_name: { required: true, description: 'Name of the quoting supplier', type: 'string' },
    product_id: { required: true, description: 'Unique identifier for the quoted SKU', type: 'string' },
    available_qty: { required: true, description: 'Available quantity offered (>= 0)', type: 'integer' },
    unit_price_egp: { required: true, description: 'Unit price in EGP', type: 'money' },
    discount_percent: { required: true, description: 'Discount percentage (0 - 100)', type: 'percentage' },
    promised_delivery_at: { required: false, description: 'Expected delivery ISO timestamp', type: 'timestamp' },
    offered_at: { required: true, description: 'ISO timestamp when quote was submitted', type: 'timestamp' },
  },
  OUTCOMES: {
    order_id: { required: true, description: 'Associated order identifier', type: 'string' },
    supplier_id: { required: true, description: 'Identifier of the supplier fulfilling the order', type: 'string' },
    product_id: { required: true, description: 'Identifier of the delivered product', type: 'string' },
    filled_qty: { required: true, description: 'Delivered quantity (>= 0)', type: 'integer' },
    delivered_at: { required: false, description: 'ISO timestamp when delivery was completed', type: 'timestamp' },
    cancelled: { required: true, description: 'Whether the fulfillment was cancelled (true/false)', type: 'boolean' },
    cancellation_reason: { required: false, description: 'Explanation if order was cancelled', type: 'string' },
    outcome_final: { required: true, description: 'Whether this outcome is final and complete', type: 'boolean' },
  },
  DECISIONS: {
    decision_id: { required: true, description: 'Unique identifier for the AI decision', type: 'string' },
    order_id: { required: true, description: 'Associated order identifier', type: 'string' },
    selected_supplier_id: { required: true, description: 'Supplier chosen by the decision', type: 'string' },
    decided_at: { required: true, description: 'ISO timestamp when decision was reached', type: 'timestamp' },
    agent_name: { required: false, description: 'Name of the decision agent or model', type: 'string' },
    agent_version: { required: false, description: 'Version of the decision agent', type: 'string' },
    confidence: { required: false, description: 'Confidence score (0.0000 - 1.0000)', type: 'percentage' },
    selection_reason: { required: false, description: 'Decision rationale or justification', type: 'string' },
  },
};
