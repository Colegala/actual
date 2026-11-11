import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutomaticBankSync } from '#hooks/useAutomaticBankSync';
import { TestProviders } from '#mocks';

const flags = vi.hoisted(() => ({ bankSync: false }));

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return {
    ...actual,
    get BANK_SYNC_ENABLED() {
      return flags.bankSync;
    },
  };
});

const syncMutate = vi.hoisted(() => vi.fn());

vi.mock('#accounts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#accounts');
  return {
    ...actual,
    useSyncAndDownloadMutation: () => ({ mutate: syncMutate }),
  };
});

vi.mock('#hooks/useAccounts', () => ({
  useAccounts: () => ({
    data: [{ id: 'a1', bank: 'b1', last_sync: null, closed: 0, offbudget: 0 }],
  }),
}));

vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: () => ['60', vi.fn()],
}));

vi.mock('#hooks/useLocalPref', () => ({
  useLocalPref: () => [undefined, vi.fn()],
}));

vi.mock('#hooks/useSyncServerStatus', () => ({
  useSyncServerStatus: () => 'online',
}));

describe('useAutomaticBankSync (home fork: bank sync gate)', () => {
  beforeEach(() => {
    syncMutate.mockReset();
  });

  it('useAutomaticBankSync does not sync when bank sync is disabled', async () => {
    flags.bankSync = false;
    renderHook(() => useAutomaticBankSync(), { wrapper: TestProviders });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(syncMutate).not.toHaveBeenCalled();
  });

  it('useAutomaticBankSync syncs when bank sync is enabled (stock)', async () => {
    flags.bankSync = true;
    renderHook(() => useAutomaticBankSync(), { wrapper: TestProviders });
    await waitFor(() => expect(syncMutate).toHaveBeenCalled());
  });
});
