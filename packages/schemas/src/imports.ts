import { z } from 'zod';

export const importKinds = ['ORDERS', 'OFFERS', 'OUTCOMES', 'DECISIONS'] as const;
export const importKindSchema = z.enum(importKinds);
export type ImportKind = z.infer<typeof importKindSchema>;

export const importHeaders = {
  ORDERS: [
    'order_id', 'pharmacy_id', 'pharmacy_name', 'placed_at', 'product_id',
    'product_name', 'manufacturer', 'requested_qty', 'unit',
  ],
  OFFERS: [
    'offer_id', 'order_id', 'supplier_id', 'supplier_name', 'product_id',
    'available_qty', 'unit_price_egp', 'discount_percent',
    'promised_delivery_at', 'offered_at',
  ],
  OUTCOMES: [
    'order_id', 'supplier_id', 'product_id', 'filled_qty', 'delivered_at',
    'cancelled', 'cancellation_reason', 'outcome_final',
  ],
  DECISIONS: [
    'decision_id', 'order_id', 'selected_supplier_id', 'decided_at',
    'agent_name', 'agent_version', 'confidence', 'selection_reason',
  ],
} as const satisfies Record<ImportKind, readonly string[]>;

const required = z.string().trim().min(1, 'Required field is missing.');
const optional = z.string().trim();
const positiveInteger = z.string().trim().regex(/^[1-9]\d*$/, 'Must be a positive integer.');
const nonNegativeInteger = z.string().trim().regex(/^\d+$/, 'Must be a nonnegative integer.');
const money = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, 'Money must contain at most two decimal places.');
const discount = z.string().trim()
  .regex(/^(?:|\d{1,3}(?:\.\d{1,2})?)$/, 'Invalid discount.')
  .refine((value) => {
    if (value === '') return true;
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')) <= 10_000n;
  }, 'Discount must be between 0 and 100 percent.');
const confidence = z.string().trim().regex(/^(?:|0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/, 'Invalid confidence.');
const booleanString = z.string().trim().toLowerCase().pipe(z.enum(['true', 'false']));

export const orderImportRowSchema = z.object({
  order_id: required,
  pharmacy_id: required,
  pharmacy_name: optional,
  placed_at: required,
  product_id: required,
  product_name: required,
  manufacturer: optional,
  requested_qty: positiveInteger,
  unit: optional,
}).strict();

export const offerImportRowSchema = z.object({
  offer_id: required,
  order_id: required,
  supplier_id: required,
  supplier_name: required,
  product_id: required,
  available_qty: nonNegativeInteger,
  unit_price_egp: money,
  discount_percent: discount,
  promised_delivery_at: optional,
  offered_at: required,
}).strict();

export const outcomeImportRowSchema = z.object({
  order_id: required,
  supplier_id: required,
  product_id: required,
  filled_qty: nonNegativeInteger,
  delivered_at: optional,
  cancelled: booleanString,
  cancellation_reason: optional,
  outcome_final: booleanString,
}).strict();

export const decisionImportRowSchema = z.object({
  decision_id: required,
  order_id: required,
  selected_supplier_id: required,
  decided_at: required,
  agent_name: optional,
  agent_version: optional,
  confidence,
  selection_reason: optional,
}).strict();

export const importRowSchemas = {
  ORDERS: orderImportRowSchema,
  OFFERS: offerImportRowSchema,
  OUTCOMES: outcomeImportRowSchema,
  DECISIONS: decisionImportRowSchema,
} as const;

export type OrderImportRow = z.infer<typeof orderImportRowSchema>;
export type OfferImportRow = z.infer<typeof offerImportRowSchema>;
export type OutcomeImportRow = z.infer<typeof outcomeImportRowSchema>;
export type DecisionImportRow = z.infer<typeof decisionImportRowSchema>;
