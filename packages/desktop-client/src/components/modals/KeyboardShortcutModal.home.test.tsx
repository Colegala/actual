import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { KeyboardShortcutModal } from './KeyboardShortcutModal';

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return { ...actual, BANK_SYNC_ENABLED: false };
});

describe('KeyboardShortcutModal (home fork)', () => {
  it('does not list a bank sync shortcut', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutModal />, { wrapper: TestProviders });
    const search = screen.getByPlaceholderText('Search shortcuts');

    // Control: a neighbouring shortcut in the same category is found.
    await user.type(search, 'import transactions');
    expect(screen.getByText('Import transactions')).toBeTruthy();

    await user.clear(search);
    await user.type(search, 'bank sync');
    expect(screen.queryByText('Bank sync')).toBeNull();
  });
});
