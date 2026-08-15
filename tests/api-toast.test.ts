import { describe, it, expect, vi } from 'vitest';
import { apiToast } from '../apps/web/src/lib/api-toast';
import { ApiError } from '../apps/web/src/lib/supabase-api';

describe('apiToast', () => {
  it('shows fallback message for non-ApiError', () => {
    const toast = { error: vi.fn() };
    apiToast(toast, new Error('generic'), 'Something failed');
    expect(toast.error).toHaveBeenCalledWith('Something failed', undefined);
  });

  it('shows ApiError.message for ApiError', () => {
    const toast = { error: vi.fn() };
    const err = new ApiError(409, 'Limite freemium');
    apiToast(toast, err, 'Fallback');
    expect(toast.error).toHaveBeenCalledWith('Fallback', 'Limite freemium');
  });

  it('shows fallback for null error', () => {
    const toast = { error: vi.fn() };
    apiToast(toast, null, 'Null error');
    expect(toast.error).toHaveBeenCalledWith('Null error', undefined);
  });

  it('shows fallback for string error', () => {
    const toast = { error: vi.fn() };
    apiToast(toast, 'string error', 'String fallback');
    expect(toast.error).toHaveBeenCalledWith('String fallback', undefined);
  });
});
