import { MemoryRouter, Route, Routes } from 'react-router';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BankSyncRoute } from './BankSyncRoute';

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

const PATHS = [
  '/bank-sync',
  '/settings/bank-sync',
  '/bank-sync/account/:id/edit',
  '/gocardless/link',
  '/enablebanking/auth_callback',
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {PATHS.map(p => (
          <Route
            key={p}
            path={p}
            element={
              <BankSyncRoute>
                <div>bank sync page</div>
              </BankSyncRoute>
            }
          />
        ))}
        <Route path="/budget" element={<div>budget page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BankSyncRoute', () => {
  beforeEach(() => {
    flags.bankSync = false;
  });

  it.each([
    '/bank-sync',
    '/settings/bank-sync',
    '/bank-sync/account/abc/edit',
    '/gocardless/link',
    '/enablebanking/auth_callback',
  ])('redirects %s to /budget when bank sync is off', path => {
    renderAt(path);
    expect(screen.queryByText('bank sync page')).toBeNull();
    expect(screen.getByText('budget page')).toBeTruthy();
  });

  it('renders the page when bank sync is on', () => {
    flags.bankSync = true;
    renderAt('/bank-sync');
    expect(screen.getByText('bank sync page')).toBeTruthy();
  });
});
