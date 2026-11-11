import { MemoryRouter } from 'react-router';

import { send } from '@actual-app/core/platform/client/connection';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
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

function renderLogin() {
  return render(
    <MemoryRouter>
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
});
