import { MemoryRouter } from 'react-router';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { CreateAccountModal } from './CreateAccountModal';

const mockDispatch = vi.fn();

vi.mock('#redux', async importOriginal => ({
  ...(await importOriginal()),
  useDispatch: () => mockDispatch,
}));

vi.mock('#components/banksync/useBuiltInBankSyncProviders', () => ({
  useBuiltInBankSyncProviders: () => ({
    providers: [
      { id: 'simplefin', name: 'SimpleFIN', isConfigured: false },
      { id: 'gocardless', name: 'GoCardless', isConfigured: false },
    ],
    syncServerStatus: 'online',
    permissionWarning: null,
  }),
}));

describe('CreateAccountModal (home fork: no bank sync)', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('does not offer bank sync setup and goes straight to a local account', () => {
    render(
      <MemoryRouter>
        <CreateAccountModal />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );

    expect(screen.queryByText('Set up bank sync')).toBeNull();
    expect(screen.queryByText(/SimpleFIN|GoCardless/)).toBeNull();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { modal: { name: 'add-local-account' } },
      }),
    );
  });

  it('does not offer provider linking when upgrading an account', () => {
    render(
      <MemoryRouter>
        <CreateAccountModal upgradingAccountId="acc-1" />
      </MemoryRouter>,
      {
        wrapper: TestProviders,
      },
    );

    expect(screen.queryByText(/SimpleFIN|GoCardless/)).toBeNull();
    expect(
      screen.queryByText(
        'Choose a bank sync provider to connect this account.',
      ),
    ).toBeNull();
  });
});
