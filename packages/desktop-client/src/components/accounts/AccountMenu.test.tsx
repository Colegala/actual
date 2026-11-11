import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { AccountMenu } from './Header';

vi.mock('#hooks/useSyncServerStatus', () => ({
  useSyncServerStatus: () => 'online',
}));

const account = {
  id: 'acc-1',
  name: 'Checking',
  closed: 0,
} as unknown as Parameters<typeof AccountMenu>[0]['account'];

describe('AccountMenu (home fork: no bank sync)', () => {
  it.each([true, false])(
    'has no Link/Unlink account item (canSync=%s)',
    canSync => {
      render(
        <AccountMenu
          account={account}
          canSync={canSync}
          showNetWorthChart
          showReconciled
          isSorted={false}
          onMenuSelect={vi.fn()}
        />,
        { wrapper: TestProviders },
      );

      expect(screen.getByText('Export')).toBeTruthy();
      expect(screen.queryByText('Link account')).toBeNull();
      expect(screen.queryByText('Unlink account')).toBeNull();
    },
  );
});
