import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { ThemeInstaller } from './ThemeInstaller';

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return { ...actual, THEME_CATALOG_ENABLED: false };
});

describe('ThemeInstaller (home fork: catalog disabled)', () => {
  it('hides the catalog but keeps the paste-CSS install', () => {
    render(<ThemeInstaller onInstall={vi.fn()} onClose={vi.fn()} />, {
      wrapper: TestProviders,
    });
    expect(screen.queryByText('Choose from catalog:')).toBeNull();
    expect(screen.getByText('Additional CSS overrides:')).toBeTruthy();
  });
});
