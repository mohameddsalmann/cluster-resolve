import { z } from 'zod';

export const datasetModeSchema = z.enum(['LIVE', 'IMPORTED_REAL', 'SAMPLE']);
export type DatasetMode = z.infer<typeof datasetModeSchema>;

export const createDatasetSchema = z.object({
  name: z.string().min(1, 'Dataset name is required').trim(),
  mode: datasetModeSchema,
  description: z.string().optional().nullable(),
});
export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;

export const datasetRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  mode: datasetModeSchema,
  description: z.string().nullable(),
  created_at: z.string(),
});
export type DatasetRow = z.infer<typeof datasetRowSchema>;
