import { describe, expect, it, vi } from 'vitest';
import {
  isTransientSupabaseError,
  withTransientRetry,
} from '../lib/imports/batch-importers';

describe('bounded Supabase batch retry', () => {
  it('recognizes network timeouts and temporary 5xx failures only', () => {
    expect(isTransientSupabaseError(new TypeError('fetch failed', {
      cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
    }))).toBe(true);
    expect(isTransientSupabaseError({ status: 503, message: 'temporarily unavailable' })).toBe(true);
    expect(isTransientSupabaseError({ code: '23505', message: 'duplicate key' })).toBe(false);
  });

  it('retries a transient chunk and then succeeds', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('fetch failed'), { code: 'ETIMEDOUT' }))
      .mockResolvedValue('ok');

    await expect(withTransientRetry(operation, 'test chunk', 3, 1)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry business or constraint failures', async () => {
    const error = Object.assign(new Error('duplicate key'), { code: '23505' });
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withTransientRetry(operation, 'test chunk', 3, 1)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('preserves the original transient error after bounded retries', async () => {
    const original = Object.assign(new Error('first timeout'), { code: 'ECONNRESET' });
    const operation = vi.fn()
      .mockRejectedValueOnce(original)
      .mockRejectedValue(Object.assign(new Error('later timeout'), { code: 'ETIMEDOUT' }));

    await expect(withTransientRetry(operation, 'test chunk', 2, 1)).rejects.toBe(original);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
