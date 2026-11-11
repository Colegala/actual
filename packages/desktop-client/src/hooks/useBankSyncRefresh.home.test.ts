import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBankSyncRefresh } from './useBankSyncRefresh';

const flags = vi.hoisted(() => ({ bankSync: false }));
const syncMutate = vi.hoisted(() => vi.fn());

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return {
    ...actual,
    get BANK_SYNC_ENABLED() {
      return flags.bankSync;
    },
  };
});

vi.mock('#accounts', () => ({
  useSyncAndDownloadMutation: () => ({ mutate: syncMutate }),
}));

describe('useBankSyncRefresh (home fork: mobile pull-to-refresh)', () => {
  beforeEach(() => {
    syncMutate.mockReset();
  });

  it('returns no refresh handler when bank sync is disabled', () => {
    flags.bankSync = false;
    const { result } = renderHook(() => useBankSyncRefresh('a1'));
    expect(result.current).toBeUndefined();
    expect(syncMutate).not.toHaveBeenCalled();
  });

  it('syncs one account when enabled (stock)', () => {
    flags.bankSync = true;
    const { result } = renderHook(() => useBankSyncRefresh('a1'));
    result.current?.();
    expect(syncMutate).toHaveBeenCalledWith({ id: 'a1' });
  });

  it('syncs all accounts when enabled and no id is given (stock)', () => {
    flags.bankSync = true;
    const { result } = renderHook(() => useBankSyncRefresh());
    result.current?.();
    expect(syncMutate).toHaveBeenCalledWith({});
  });
});
