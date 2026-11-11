import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, useLocation } from 'react-router';

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { FinancesApp } from './FinancesApp';

// Renders the real FinancesApp route tree. Everything around the routes
// (sidebar, titlebar, pages) is stubbed; only routing and BankSyncRoute are
// real, with the real home-fork flags (BANK_SYNC_ENABLED = false).

const responsive = vi.hoisted(() => ({ isNarrowWidth: false }));
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isNarrowWidth: responsive.isNarrowWidth,
    isSmallWidth: responsive.isNarrowWidth,
    isMediumWidth: false,
    isWideWidth: !responsive.isNarrowWidth,
    atLeastMediumWidth: !responsive.isNarrowWidth,
    width: responsive.isNarrowWidth ? 400 : 1024,
  }),
}));

vi.mock('#app/appSlice', async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>('#app/appSlice');
  const noop = () => ({ type: 'test/noop' });
  return { ...actual, sync: noop, getLatestAppVersion: noop };
});
vi.mock('#hooks/useAutomaticBankSync', () => ({
  useAutomaticBankSync: () => undefined,
}));
vi.mock('#hooks/useNewsNotification', () => ({
  useNewsNotification: () => undefined,
}));
vi.mock('#hooks/useMetaThemeColor', () => ({
  useMetaThemeColor: () => undefined,
}));
vi.mock('./responsive', () => ({
  NarrowAlternate: ({ name }: { name: string }) => <div>page:{name}</div>,
  WideComponent: ({ name }: { name: string }) => <div>page:{name}</div>,
}));
vi.mock('./sidebar/SidebarMenuRoute', () => ({
  SidebarMenuRoute: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./mobile/banksync/MobileBankSyncAccountEditPage', () => ({
  MobileBankSyncAccountEditPage: () => (
    <div>page:MobileBankSyncAccountEdit</div>
  ),
}));
vi.mock('./EnableBankingCallback', () => ({
  EnableBankingCallback: () => <div>page:EnableBankingCallback</div>,
}));
vi.mock('./StartPageRedirect', () => ({ StartPageRedirect: () => null }));
vi.mock('./reports', () => ({ Reports: () => null }));
vi.mock('./settings', () => ({
  Settings: () => <Outlet />,
  SettingsIndex: () => null,
  GeneralSettings: () => null,
  AdvancedSettings: () => null,
  ExperimentalSettings: () => null,
}));
vi.mock('./admin/UserAccess/UserAccessPage', () => ({
  UserAccessPage: () => null,
}));
vi.mock('./admin/UserDirectory/UserDirectoryPage', () => ({
  UserDirectoryPage: () => null,
}));
vi.mock('./mobile/MobileNavTabs', () => ({ MobileNavTabs: () => null }));
vi.mock('./mobile/transactions/TransactionEdit', () => ({
  TransactionEdit: () => null,
}));
vi.mock('./news/NotificationsPage', () => ({ NotificationsPage: () => null }));
vi.mock('./tags/ManageTagsPage', () => ({ ManageTagsPage: () => null }));
vi.mock('./sidebar', () => ({ FloatableSidebar: () => null }));
vi.mock('./Titlebar', () => ({ Titlebar: () => null }));
vi.mock('./Notifications', () => ({ Notifications: () => null }));
vi.mock('./BankSyncStatus', () => ({ BankSyncStatus: () => null }));
vi.mock('./CommandBar', () => ({ CommandBar: () => null }));
vi.mock('./ContextMenu', () => ({ ContextMenu: () => null }));
vi.mock('./GlobalKeys', () => ({ GlobalKeys: () => null }));
vi.mock('./tour/Tour', () => ({ Tour: () => null }));
vi.mock('./tour/TourAutoOffer', () => ({ TourAutoOffer: () => null }));
vi.mock('./tour/TourProvider', () => ({
  TourProvider: ({ children }: { children: ReactNode }) => children,
}));

// FinancesApp waits for an app update; in tests there is never one.
global.Actual.waitForUpdateReadyForDownload = () =>
  new Promise<void>(() => undefined);

function Pathname() {
  return <div data-testid="pathname">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FinancesApp />
      <Pathname />
    </MemoryRouter>,
    { wrapper: TestProviders },
  );
}

const BANK_SYNC_PATHS = [
  '/bank-sync',
  '/settings/bank-sync',
  '/bank-sync/account/a1/edit',
  '/gocardless/link',
  '/enablebanking/auth_callback',
];

describe.each([
  ['narrow', true],
  ['wide', false],
])(
  'FinancesApp routes at %s width (home fork: bank sync gated)',
  (_, narrow) => {
    beforeEach(() => {
      responsive.isNarrowWidth = narrow;
    });

    it.each(BANK_SYNC_PATHS)('redirects %s to /budget', async path => {
      renderAt(path);
      await waitFor(() =>
        expect(screen.getByTestId('pathname').textContent).toBe('/budget'),
      );
      expect(screen.queryByText(/page:(BankSync|GoCardlessLink)/)).toBeNull();
      expect(screen.queryByText('page:EnableBankingCallback')).toBeNull();
      expect(screen.queryByText('page:MobileBankSyncAccountEdit')).toBeNull();
    });

    it('does not redirect other routes (control)', async () => {
      renderAt('/accounts');
      expect(await screen.findByText('page:Accounts')).toBeDefined();
      expect(screen.getByTestId('pathname').textContent).toBe('/accounts');
    });
  },
);
