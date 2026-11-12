import { MemoryRouter } from 'react-router';

import { send } from '@actual-app/core/platform/client/connection';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestAppStore, TestProviders } from '#mocks';
import { pushModal } from '#modals/modalsSlice';

import { BANK_SYNC_MODALS } from './bankSyncGate';
import { Modals } from './Modals';

const flags = vi.hoisted(() => ({ bankSync: false }));

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn().mockResolvedValue({}),
  sendCatch: vi.fn().mockResolvedValue({}),
  listen: vi.fn(() => vi.fn()),
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

function renderWithModal(name: string) {
  const store = createTestAppStore();
  const result = render(
    <TestProviders store={store}>
      <MemoryRouter>
        <Modals />
      </MemoryRouter>
    </TestProviders>,
  );
  // Push after mount: Modals closes every modal on its first location effect.
  act(() => {
    // The options are never read: the modal must not render at all.
    store.dispatch(pushModal({ modal: { name, options: {} } as never }));
  });
  expect(store.getState().modals.modalStack).toHaveLength(1);
  return result;
}

describe('Modals (home fork: bank sync modals are blocked)', () => {
  beforeEach(() => {
    flags.bankSync = false;
    vi.mocked(send).mockClear();
  });

  it.each([...BANK_SYNC_MODALS])(
    'renders nothing and sends nothing for %s when bank sync is disabled',
    async name => {
      const { container } = renderWithModal(name);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(container).toBeEmptyDOMElement();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('covers every bank sync modal that sends to a bank route', () => {
    expect([...BANK_SYNC_MODALS].sort()).toEqual(
      [
        'akahu-init',
        'enablebanking-external-msg',
        'enablebanking-init',
        'gocardless-external-msg',
        'gocardless-init',
        'pluggyai-init',
        'select-linked-accounts',
        'simplefin-init',
      ].sort(),
    );
  });
});
