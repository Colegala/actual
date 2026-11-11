import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { useSidebarMenu } from './useSidebarMenu';

vi.mock('#hooks/useSyncServerStatus', () => ({
  useSyncServerStatus: () => 'online',
}));

describe('useSidebarMenu (home fork: no bank sync)', () => {
  it('never lists the bank-sync page, even with a server', () => {
    const { result } = renderHook(() => useSidebarMenu(), {
      wrapper: TestProviders,
    });

    expect(result.current.isItemAvailable('bank-sync')).toBe(false);
    expect(result.current.availableItems.map(i => i.id)).not.toContain(
      'bank-sync',
    );
  });
});
