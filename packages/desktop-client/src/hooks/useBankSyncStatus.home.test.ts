import { send } from '@actual-app/core/platform/client/connection';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAkahuStatus } from './useAkahuStatus';
import { useEnableBankingStatus } from './useEnableBankingStatus';
import { useGoCardlessStatus } from './useGoCardlessStatus';
import { usePluggyAiStatus } from './usePluggyAiStatus';
import { useSimpleFinStatus } from './useSimpleFinStatus';

const flags = vi.hoisted(() => ({ bankSync: false }));

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
}));

vi.mock('./useSyncServerStatus', () => ({
  useSyncServerStatus: () => 'online',
}));

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return {
    ...actual,
    get BANK_SYNC_ENABLED() {
      return flags.bankSync;
    },
  };
});

const hooks: Array<[string, () => unknown]> = [
  ['gocardless-status', () => useGoCardlessStatus()],
  ['simplefin-status', () => useSimpleFinStatus()],
  ['pluggyai-status', () => usePluggyAiStatus()],
  ['akahu-status', () => useAkahuStatus()],
  ['enablebanking-status', () => useEnableBankingStatus()],
];

describe('bank sync status hooks (home fork)', () => {
  beforeEach(() => {
    vi.mocked(send).mockReset();
    vi.mocked(send).mockResolvedValue({ configured: false });
  });

  it.each(hooks)(
    'does not send %s when bank sync is disabled',
    async (_name, useHook) => {
      flags.bankSync = false;
      renderHook(useHook);
      // Let any effect-started request reach send().
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(send).not.toHaveBeenCalled();
    },
  );

  it.each(hooks)(
    'still sends %s when bank sync is enabled',
    async (name, useHook) => {
      flags.bankSync = true;
      renderHook(useHook);
      await waitFor(() => expect(send).toHaveBeenCalledWith(name));
    },
  );
});
