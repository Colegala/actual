import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestAppStore, TestProviders } from '#mocks';

import { TourAutoOffer } from './TourAutoOffer';
import { TOUR_OFFER_NOTIFICATION_ID } from './TourProvider';

const flags = vi.hoisted(() => ({ autoOpen: true }));

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return {
    ...actual,
    get AUTO_OPEN_BUDGET() {
      return flags.autoOpen;
    },
  };
});

// The offer is normally skipped in tests and on narrow screens.
vi.mock('#hooks/useIsTestEnv', () => ({ useIsTestEnv: () => false }));
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: false }),
}));

vi.mock('#hooks/useLocalPref', () => ({
  useLocalPref: () => [false, vi.fn()],
}));

vi.mock('./TourProvider', () => ({
  TOUR_OFFER_NOTIFICATION_ID: 'tour-offer',
  useTour: () => ({ startTour: vi.fn() }),
}));

function offerShown(store: ReturnType<typeof createTestAppStore>) {
  return store
    .getState()
    .notifications.notifications.some(n => n.id === TOUR_OFFER_NOTIFICATION_ID);
}

describe('TourAutoOffer (home fork)', () => {
  beforeEach(() => {
    flags.autoOpen = true;
  });

  it('does not offer the first-run tour when the budget opens automatically', () => {
    const store = createTestAppStore();
    render(
      <TestProviders store={store}>
        <TourAutoOffer />
      </TestProviders>,
    );
    expect(offerShown(store)).toBe(false);
  });

  it('still offers the tour when the flag is off', () => {
    flags.autoOpen = false;
    const store = createTestAppStore();
    render(
      <TestProviders store={store}>
        <TourAutoOffer />
      </TestProviders>,
    );
    expect(offerShown(store)).toBe(true);
  });
});
