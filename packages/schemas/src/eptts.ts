import { z } from 'zod';

export const TraceabilityFormatSchema = z.enum(['CSV', 'XML_BARE', 'XML_SOAP']);
export type TraceabilityFormat = z.infer<typeof TraceabilityFormatSchema>;

export const PreflightStatusSchema = z.enum(['PASS', 'FAIL']);
export type PreflightStatus = z.infer<typeof PreflightStatusSchema>;

export const FindingSeveritySchema = z.enum(['ERROR', 'WARNING']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const EpttsCsvRowSchema = z.object({
  seqNo: z.string(),
  Bizstep: z.string(),
  eventTime: z.string(),
  timeOffset: z.string(),
  readPointGLN: z.string(),
  bizLocationGLN: z.string(),
  epc: z.string(),
  Parent: z.string(),
  import: z.string(),
  expiryDate: z.string(),
  manufDate: z.string(),
});
export type EpttsCsvRow = z.infer<typeof EpttsCsvRowSchema>;

export const PreflightFindingSchema = z.object({
  code: z.string(),
  severity: FindingSeveritySchema,
  rowOrEventIndex: z.number().int().nullable().optional(),
  field: z.string().nullable().optional(),
  message: z.string(),
  evidence: z.string().nullable().optional(),
  officialRuleReference: z.string(),
});
export type PreflightFinding = z.infer<typeof PreflightFindingSchema>;

export const PreflightResultSchema = z.object({
  status: PreflightStatusSchema,
  format: TraceabilityFormatSchema,
  rulesVersion: z.string(),
  totalRows: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  serialCount: z.number().int().nonnegative(),
  batchCount: z.number().int().nonnegative(),
  findings: z.array(PreflightFindingSchema),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  wording: z.string(),
  senderGln: z.string().nullable().optional(),
  receiverGln: z.string().nullable().optional(),
  instanceIdentifier: z.string().nullable().optional(),
});
export type PreflightResult = z.infer<typeof PreflightResultSchema>;
