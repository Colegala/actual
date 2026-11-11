import { MemoryRouter, useLocation, useNavigationType } from 'react-router';

import { send } from '@actual-app/core/platform/client/connection';
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLoginMethod } from '#components/ServerContext';
import { TestProviders } from '#mocks';

import { Login } from './Login';

const flags = vi.hoisted(() => ({ headerLogin: true }));

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
}));

vi.mock('./common', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('./common');
  return { ...actual, useBootstrapped: () => ({ checked: true }) };
});

vi.mock('#home-fork', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('#home-fork');
  return {
    ...actual,
    get HOME_HEADER_LOGIN() {
      return flags.headerLogin;
    },
  };
});

function HistoryProbe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <div data-testid="history">
      {type} {location.pathname}
      {location.search}
    </div>
  );
}

function renderLogin(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Login />
    </MemoryRouter>,
    { wrapper: TestProviders },
  );
}

describe('Login (home fork: header login)', () => {
  beforeEach(() => {
    vi.mocked(send).mockReset();
    vi.mocked(send).mockResolvedValue({});
    flags.headerLogin = true;
  });

  it('useLoginMethod returns header when no methods are loaded', () => {
    const { result } = renderHook(() => useLoginMethod());
    expect(result.current).toBe('header');
  });

  it('useLoginMethod keeps stock behavior when the flag is off', () => {
    flags.headerLogin = false;
    const { result } = renderHook(() => useLoginMethod());
    expect(result.current).toBe('password');
  });

  it('signs in with the header method and shows no password field', async () => {
    renderLogin();

    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText('Sign in')).toBeNull();
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith('subscribe-sign-in', {
        password: '',
        loginMethod: 'header',
      }),
    );
  });

  it('shows the password field when the flag is off (stock)', () => {
    flags.headerLogin = false;
    renderLogin();
    expect(document.querySelector('input[type="password"]')).not.toBeNull();
  });

  it('shows the error and Retry, not the password link, when header sign-in fails', async () => {
    vi.mocked(send).mockResolvedValue({ error: 'invalid-header' });
    renderLogin();

    expect(
      await screen.findAllByText('Auto login failed - No header sent'),
    ).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(screen.queryByText('Log in with password')).toBeNull();
    expect(screen.queryByText(/Checking Header Token Login/)).toBeNull();
  });

  it('Retry signs in with the header method again', async () => {
    vi.mocked(send).mockResolvedValue({ error: 'invalid-header' });
    renderLogin();

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    // let any extra effect runs settle, then assert there are exactly 2
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('Retry from /login?error=x replaces the history entry', async () => {
    vi.mocked(send).mockResolvedValue({ error: 'invalid-header' });
    render(
      <MemoryRouter initialEntries={['/login?error=x']}>
        <Login />
        <HistoryProbe />
      </MemoryRouter>,
      { wrapper: TestProviders },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('history').textContent).toBe('REPLACE /login');
  });

  it('shows the error and Retry for /login?error=x, with no endless spinner', async () => {
    renderLogin('/login?error=x');

    expect(
      (await screen.findAllByText('An unknown error occurred: x')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(screen.queryByText(/Checking Header Token Login/)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the stock password link when the flag is off', () => {
    flags.headerLogin = false;
    renderLogin('/login?error=x');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
