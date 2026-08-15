import { z } from 'zod';
import { TraceabilityFormatSchema } from './eptts';

export const CanonicalEventTypeSchema = z.enum([
  'COMMISSIONING',
  'PACKING',
  'SHIPPING',
]);
export type CanonicalEventType = z.infer<typeof CanonicalEventTypeSchema>;

export const ProductLinkStatusSchema = z.enum(['CONFIRMED', 'SUGGESTED']);
export type ProductLinkStatus = z.infer<typeof ProductLinkStatusSchema>;

export const ReconciliationStatusSchema = z.enum([
  'MATCH',
  'MISMATCH',
  'INSUFFICIENT_LINKAGE',
  'INSUFFICIENT_TRACEABILITY_DATA',
]);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatusSchema>;

export const ExpiryBucketSchema = z.enum([
  'EXPIRED',
  'EXPIRING_90',
  'EXPIRING_180',
  'LATER',
  'UNKNOWN',
]);
export type ExpiryBucket = z.infer<typeof ExpiryBucketSchema>;

export const CanonicalTraceabilityEventSchema = z.object({
  id: z.string().uuid().optional(),
  datasetId: z.string().uuid(),
  importId: z.string().uuid(),
  eventType: CanonicalEventTypeSchema,
  eventTime: z.string().datetime(),
  timezoneOffset: z.string().nullable().optional(),
  epc: z.string(),
  gtin: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  sscc: z.string().nullable().optional(),
  batch: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  manufacturingDate: z.string().nullable().optional(),
  parentEpc: z.string().nullable().optional(),
  readPointGln: z.string(),
  bizLocationGln: z.string(),
  sourceGln: z.string().nullable().optional(),
  destinationGln: z.string().nullable().optional(),
  bizTransactionRef: z.string().nullable().optional(),
  sourceFormat: TraceabilityFormatSchema,
  sourceIndex: z.number().int().nonnegative(),
});
export type CanonicalTraceabilityEvent = z.infer<typeof CanonicalTraceabilityEventSchema>;

export const TraceabilityProductLinkSchema = z.object({
  id: z.string().uuid().optional(),
  datasetId: z.string().uuid(),
  productId: z.string().uuid(),
  gtin: z.string(),
  status: ProductLinkStatusSchema,
  confidenceReason: z.string(),
  createdAt: z.string().datetime().optional(),
});
export type TraceabilityProductLink = z.infer<typeof TraceabilityProductLinkSchema>;

export const ExpiryIntelligenceItemSchema = z.object({
  gtin: z.string(),
  productName: z.string().nullable().optional(),
  serial: z.string(),
  batch: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  daysToExpiry: z.number().int().nullable().optional(),
  bucket: ExpiryBucketSchema,
  readPointGln: z.string(),
  lastEventTime: z.string().datetime(),
});
export type ExpiryIntelligenceItem = z.infer<typeof ExpiryIntelligenceItemSchema>;

export const ExpirySummarySchema = z.object({
  asOfDate: z.string().datetime(),
  totalSerializedUnits: z.number().int().nonnegative(),
  expiredCount: z.number().int().nonnegative(),
  expiring90DaysCount: z.number().int().nonnegative(),
  expiring180DaysCount: z.number().int().nonnegative(),
  laterCount: z.number().int().nonnegative(),
  unknownExpiryCount: z.number().int().nonnegative(),
});
export type ExpirySummary = z.infer<typeof ExpirySummarySchema>;

export const OrderReconciliationRecordSchema = z.object({
  id: z.string().uuid().optional(),
  datasetId: z.string().uuid(),
  orderId: z.string().uuid(),
  externalOrderId: z.string(),
  productId: z.string().uuid(),
  productName: z.string(),
  gtin: z.string().nullable().optional(),
  reconciliationStatus: ReconciliationStatusSchema,
  operationalQty: z.number().int().nonnegative(),
  traceabilityQty: z.number().int().nonnegative(),
  differenceQty: z.number().int(),
  businessRef: z.string().nullable().optional(),
  linkedImportId: z.string().uuid().nullable().optional(),
  evidenceJson: z.record(z.unknown()).default({}),
  reconciledAt: z.string().datetime().optional(),
});
export type OrderReconciliationRecord = z.infer<typeof OrderReconciliationRecordSchema>;
