import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { MemoryRouter } from 'react-router';

import { initServer } from '@actual-app/core/platform/client/connection';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SpreadsheetProvider } from '#hooks/useSpreadsheet';
import { TestProviders } from '#mocks';

import { MobilePageHeader } from './Page';
import { SidebarFooter } from './sidebar/redesign/SidebarFooter';
import { Sidebar } from './sidebar/Sidebar';
import { SidebarProvider } from './sidebar/SidebarProvider';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);

window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => false),
});

function expectHomeLink() {
  const link = screen.getByRole('link', { name: 'Home' });
  expect(link.getAttribute('href')).toBe('https://cole.local/');
  expect(link.getAttribute('target')).toBeNull();
}

describe('Home button', () => {
  it('renders in the desktop sidebar', () => {
    initServer({
      query: async () => ({ data: [], dependencies: [] }),
      'get-cell': async () => ({ name: 'test-cell', value: 0 }),
    });
    render(
      <MemoryRouter>
        <SpreadsheetProvider>
          <DndProvider backend={HTML5Backend}>
            <SidebarProvider>
              <Sidebar />
            </SidebarProvider>
          </DndProvider>
        </SpreadsheetProvider>
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    expectHomeLink();
  });

  it('renders in the redesigned desktop sidebar footer', () => {
    render(
      <MemoryRouter>
        <SidebarFooter />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    expectHomeLink();
  });

  it('renders in the mobile header', () => {
    render(
      <MemoryRouter>
        <MobilePageHeader title="Budget" />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    expectHomeLink();
  });

  it('renders in the mobile header beside non-back left content (budget menu)', () => {
    render(
      <MemoryRouter>
        <MobilePageHeader
          title="Budget"
          showHomeLink
          leftContent={<button type="button">Budget page menu</button>}
        />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    expect(
      screen.getByRole('button', { name: 'Budget page menu' }),
    ).toBeTruthy();
    expectHomeLink();
  });

  it('has a tap target of at least 44px in the mobile header', () => {
    render(
      <MemoryRouter>
        <MobilePageHeader title="Budget" />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.style.minHeight).toBe('44px');
    expect(link.style.minWidth).toBe('44px');
  });

  it('keeps a tall tap target beside the budget menu button without overflowing', () => {
    render(
      <MemoryRouter>
        <MobilePageHeader
          title="Budget"
          showHomeLink
          leftContent={<button type="button">Budget page menu</button>}
        />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.style.minHeight).toBe('44px');
    expect(link.style.minWidth).toContain('44px');
  });

  it('leaves the desktop sidebar link unstyled', () => {
    render(
      <MemoryRouter>
        <SidebarFooter />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.style.minHeight).toBe('');
    expect(link.style.minWidth).toBe('');
  });

  it('is hidden in the mobile header when a back button is present', () => {
    render(
      <MemoryRouter>
        <MobilePageHeader
          title="Budget"
          leftContent={<button type="button">Back</button>}
        />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
  });
});
