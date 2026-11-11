import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetTestProviders, TestProviders } from '#mocks';

import { useNewsFeed } from './useNewsFeed';

vi.mock('#hooks/useGlobalPref', () => ({
  useGlobalPref: (key: string) =>
    key === 'showNewsFeed' ? [true, vi.fn()] : [undefined, vi.fn()],
}));

describe('useNewsFeed (home fork: news feed forced off)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetTestProviders();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is disabled and makes no request even if the pref is on', async () => {
    const { result } = renderHook(() => useNewsFeed(), {
      wrapper: TestProviders,
    });

    expect(result.current.isEnabled).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
