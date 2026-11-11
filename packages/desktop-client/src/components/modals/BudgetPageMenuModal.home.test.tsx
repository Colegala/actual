import { initServer } from '@actual-app/core/platform/client/connection';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOME_URL } from '#home-fork';
import { TestProviders } from '#mocks';

import { BudgetPageMenuModal } from './BudgetPageMenuModal';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: true }),
}));

describe('BudgetPageMenuModal (home fork)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has a Home item that goes to the home URL', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    initServer({});
    render(
      <TestProviders>
        <BudgetPageMenuModal
          onAddCategoryGroup={vi.fn()}
          onToggleHiddenCategories={vi.fn()}
          onSwitchBudgetFile={vi.fn()}
        />
      </TestProviders>,
    );

    await userEvent.click(await screen.findByText('Home'));
    expect(assign).toHaveBeenCalledWith(HOME_URL);
  });
});
