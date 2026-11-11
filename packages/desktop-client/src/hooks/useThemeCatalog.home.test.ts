import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeCatalog } from './useThemeCatalog';

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return { ...actual, THEME_CATALOG_ENABLED: false };
});

describe('useThemeCatalog (home fork: catalog disabled)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes no request and is not loading', async () => {
    const { result } = renderHook(() => useThemeCatalog());
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });
});
