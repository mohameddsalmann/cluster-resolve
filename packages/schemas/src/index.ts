import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export * from './datasets';
export * from './data-sources';
export * from './money';
export * from './imports';
export * from './mapping';
export * from './operations';
export * from './regulatory';
export * from './eptts';
export * from './traceability';

