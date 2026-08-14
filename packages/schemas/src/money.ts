import { z } from 'zod';

/**
 * Validates a string decimal representation of EGP (e.g. "125.50", "8220.00", "0.01", "100")
 * for safe API/JSON boundary transfer.
 */
export const moneyStringSchema = z.string().refine(
  (val) => {
    if (!val || typeof val !== 'string') return false;
    return /^(-)?(\d+)(?:\.(\d{1,2}))?$/.test(val.trim());
  },
  {
    message: 'Invalid monetary string format. Expected format like "125.50" or "100" with max 2 decimal places.',
  }
);
