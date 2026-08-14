import { z } from 'zod';

export const dataSourceKindSchema = z.enum(['EDA', 'CSV', 'JSON', 'EPTTS', 'SAMPLE_GENERATOR']);
export type DataSourceKind = z.infer<typeof dataSourceKindSchema>;

export const acquisitionModeSchema = z.enum(['MANUAL_ASSISTED', 'AUTOMATED', 'FILE_IMPORT', 'GENERATED']);
export type AcquisitionMode = z.infer<typeof acquisitionModeSchema>;

export const dataSourceStatusSchema = z.enum(['READY', 'PROCESSING', 'FAILED', 'NOT_CONNECTED']);
export type DataSourceStatus = z.infer<typeof dataSourceStatusSchema>;

export const dataSourceRowSchema = z.object({
  id: z.string().uuid(),
  dataset_id: z.string().uuid(),
  kind: dataSourceKindSchema,
  acquisition_mode: acquisitionModeSchema,
  name: z.string(),
  source_url: z.string().url().nullable().optional(),
  status: dataSourceStatusSchema,
  last_ingested_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type DataSourceRow = z.infer<typeof dataSourceRowSchema>;
