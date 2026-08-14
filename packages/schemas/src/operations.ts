import { z } from 'zod';

const explicitTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export const evaluateDatasetSchema = z.object({
  asOf: z.string().regex(explicitTimezone, 'asOf must be an ISO timestamp with an explicit timezone.').optional(),
}).strict();

export type EvaluateDatasetInput = z.infer<typeof evaluateDatasetSchema>;
