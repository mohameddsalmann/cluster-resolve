import { z } from 'zod';

export const NoticeTypeSchema = z.enum([
  'RECALL',
  'ALERT',
  'COMMERCIAL_FRAUD',
  'AWARENESS',
  'OTHER',
]);
export type NoticeType = z.infer<typeof NoticeTypeSchema>;

export const RecallClassSchema = z.enum([
  'CLASS_I',
  'CLASS_II',
  'CLASS_III',
]);
export type RecallClass = z.infer<typeof RecallClassSchema>;

export const RegulatoryMatchStatusSchema = z.enum([
  'EXACT',
  'POSSIBLE',
  'UNMATCHED',
]);
export type RegulatoryMatchStatus = z.infer<typeof RegulatoryMatchStatusSchema>;

export const RegulatoryNoticeSchema = z.object({
  id: z.string().uuid().optional(),
  noticeNumber: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  noticeType: NoticeTypeSchema,
  recallClass: RecallClassSchema.nullable().optional(),
  productName: z.string().min(1),
  productNameNormalized: z.string().min(1),
  manufacturer: z.string().nullable().optional(),
  manufacturerNormalized: z.string().nullable().optional(),
  batchNumbers: z.array(z.string()).default([]),
  registrationNumber: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  sourceUrl: z.string().url(),
  sourceAuthority: z.string().default('Egyptian Drug Authority'),
  sourceDocCode: z.string().nullable().optional(),
  sourceVersion: z.string().nullable().optional(),
  sourceChecksum: z.string().nullable().optional(),
  retrievedAt: z.string().datetime().optional(),
});
export type RegulatoryNotice = z.infer<typeof RegulatoryNoticeSchema>;

export const RegulatoryExposureSchema = z.object({
  id: z.string().uuid().optional(),
  datasetId: z.string().uuid(),
  noticeId: z.string().uuid(),
  matchStatus: RegulatoryMatchStatusSchema,
  matchReason: z.string(),
  matchedProductId: z.string().uuid().nullable().optional(),
  affectedOrdersCount: z.number().int().nonnegative().default(0),
  affectedPharmaciesCount: z.number().int().nonnegative().default(0),
  affectedSuppliersCount: z.number().int().nonnegative().default(0),
  requestedUnits: z.number().int().nonnegative().default(0),
  filledUnits: z.number().int().nonnegative().default(0),
  historicalValueMinor: z.bigint().default(0n),
  evidenceJson: z.record(z.unknown()).default({}),
  evaluatedAt: z.string().datetime().optional(),
});
export type RegulatoryExposure = z.infer<typeof RegulatoryExposureSchema>;

export const RegulatorySyncResultSchema = z.object({
  sourceAuthority: z.string(),
  retrievalTimestamp: z.string().datetime(),
  totalNoticesFound: z.number().int().nonnegative(),
  newNoticesCount: z.number().int().nonnegative(),
  updatedNoticesCount: z.number().int().nonnegative(),
  exposuresEvaluated: z.number().int().nonnegative(),
  exactMatchesCount: z.number().int().nonnegative(),
  possibleMatchesCount: z.number().int().nonnegative(),
});
export type RegulatorySyncResult = z.infer<typeof RegulatorySyncResultSchema>;
