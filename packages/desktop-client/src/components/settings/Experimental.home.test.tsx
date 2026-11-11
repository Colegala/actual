import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { ExperimentalFeatures } from './Experimental';

vi.mock('#hooks/useSyncServerStatus', () => ({
  useSyncServerStatus: () => 'online',
}));

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return { ...actual, BANK_SYNC_ENABLED: false };
});

describe('ExperimentalFeatures (home fork)', () => {
  it('hides the Enable Banking and Akahu toggles', () => {
    render(<ExperimentalFeatures />, { wrapper: TestProviders });
    expect(screen.getByText('Budget Analysis Report')).toBeTruthy();
    expect(screen.queryByText(/Enable Banking/)).toBeNull();
    expect(screen.queryByText(/Akahu/)).toBeNull();
  });
});
