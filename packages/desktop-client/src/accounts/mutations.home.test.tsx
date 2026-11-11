import type { ReactNode } from 'react';

import { generateAccount } from '@actual-app/core/mocks';
import * as connection from '@actual-app/core/platform/client/connection';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { accountQueries } from '#accounts';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';

import { useSyncAccountsMutation } from './mutations';

// setupTests loads the app (and the real connection) before this file's mocks
// run, so spy on `send` instead of replacing the module.
const send = vi.spyOn(connection, 'send');

// Runs against the real home-fork flags (BANK_SYNC_ENABLED = false).
describe('useSyncAccountsMutation (home fork: bank sync gate)', () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let store: ReturnType<typeof configureTestAppStore>;
  // Defined once: a wrapper recreated on every render would remount the hook.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestProviders queryClient={queryClient} store={store}>
      {children}
    </TestProviders>
  );

  beforeEach(() => {
    queryClient = createTestQueryClient();
    store = configureTestAppStore({ queryClient });
    queryClient.setQueryData(accountQueries.list().queryKey, [
      { ...generateAccount('Linked', true), id: 'a1', bank: 'b1' },
    ]);
    send.mockReset();
    send.mockImplementation((async (name: string) =>
      name === 'accounts-bank-sync'
        ? {
            errors: [],
            newTransactions: [],
            matchedTransactions: [],
            updatedAccounts: [],
          }
        : []) as typeof connection.send);
  });

  it('sends no bank sync request when disabled', async () => {
    const { result } = renderHook(() => useSyncAccountsMutation(), {
      wrapper,
    });
    await result.current.mutateAsync({});
    expect(send).not.toHaveBeenCalledWith(
      'accounts-bank-sync',
      expect.anything(),
    );
    expect(send).not.toHaveBeenCalledWith(
      'simplefin-batch-sync',
      expect.anything(),
    );
  });
});
