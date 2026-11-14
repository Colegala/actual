import { MemoryRouter } from 'react-router';

import * as connection from '@actual-app/core/platform/client/connection';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setAppState } from '#app/appSlice';
import { AuthProvider } from '#auth/AuthProvider';
import {
  allowAutoOpen,
  closeBudget,
  loadBudget,
} from '#budgetfiles/budgetfilesSlice';
import { createTestAppStore, TestProviders } from '#mocks';

import { ManagementApp } from './ManagementApp';

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

// setupTests loads the store (and the real connection) before this file's
// mocks run, so spy on `send` instead of replacing the module.
const send = vi.spyOn(connection, 'send');

type Answers = {
  remoteFiles: Array<unknown[] | null>;
  budgets?: Array<{ id: string; name: string }>;
  lastOpened?: string | null;
  // Screen text seen when the budget is created.
  screenAtCreate?: string;
};
let answers: Answers;

function mockServer() {
  send.mockImplementation((async (name: string) => {
    switch (name) {
      case 'subscribe-get-user':
        return { offline: false, userName: 'home', permission: 'ADMIN' };
      case 'get-budgets':
        return answers.budgets ?? [];
      case 'get-remote-files':
        return answers.remoteFiles.length > 1
          ? answers.remoteFiles.shift()
          : answers.remoteFiles[0];
      case 'get-last-opened-backup':
        return answers.lastOpened ?? null;
      case 'load-budget':
        return {};
      case 'create-budget':
        answers.screenAtCreate = document.body.textContent ?? '';
        return {};
      case 'load-prefs':
        return answers.lastOpened ? { id: answers.lastOpened } : {};
      case 'load-global-prefs':
      case 'preferences/get':
        return {};
      default:
        return null;
    }
  }) as unknown as typeof connection.send);
}

/** A store after App start-up finished, so auto-open may run. */
function startedStore() {
  const store = createTestAppStore();
  store.dispatch(allowAutoOpen());
  return store;
}

function renderManager(store = startedStore()) {
  render(
    <TestProviders store={store}>
      <AuthProvider>
        <MemoryRouter>
          <ManagementApp />
        </MemoryRouter>
      </AuthProvider>
    </TestProviders>,
  );
  return store;
}

function sentNames() {
  return send.mock.calls.map(call => call[0]);
}

describe('ManagementApp (home fork: open the budget automatically)', () => {
  beforeEach(() => {
    flags.autoOpen = true;
    answers = { remoteFiles: [[]] };
    send.mockReset();
    mockServer();
  });

  it('creates and opens a budget without showing the welcome screen', async () => {
    renderManager();

    await waitFor(() => expect(sentNames()).toContain('create-budget'));
    expect(send).toHaveBeenCalledWith('create-budget', {
      testMode: false,
      budgetName: 'My Budget',
    });
    // Only the loading indicator was on screen while it ran.
    expect(answers.screenAtCreate).not.toContain('Welcome to Actual');
    expect(answers.screenAtCreate).not.toContain('Start budgeting');
    expect(answers.screenAtCreate).toMatch(/(Opening|Creating) budget\.\.\./);
  });

  it('shows a centered Retry message, not the welcome screen, when the file list fails', async () => {
    answers = { remoteFiles: [null] };
    renderManager();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(
      screen.getByText('Could not reach the budget server.'),
    ).toBeVisible();
    expect(screen.queryByText('Welcome to Actual')).toBeNull();
    expect(sentNames()).not.toContain('create-budget');

    answers = { remoteFiles: [[]] };
    fireEvent.click(retry);

    await waitFor(() => expect(sentNames()).toContain('create-budget'));
  });

  it('shows Retry, never the file picker, when the remote-only download fails, then retries by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    let downloadOk = false;
    answers = {
      remoteFiles: [
        [
          {
            deleted: false,
            fileId: 'cloud-1',
            groupId: 'g',
            name: 'My Budget',
            encryptKeyId: '',
            hasKey: true,
            owner: '',
            usersWithAccess: [],
          },
        ],
      ],
    };
    const base = send.getMockImplementation()!;
    send.mockImplementation((async (name: string, ...rest: unknown[]) => {
      if (name === 'download-budget') {
        return downloadOk
          ? { id: 'downloaded-id' }
          : { error: { reason: 'network' } };
      }
      if (name === 'load-prefs' && downloadOk) {
        return { id: 'downloaded-id' };
      }
      return (base as (...a: unknown[]) => unknown)(name, ...rest);
    }) as unknown as typeof connection.send);

    renderManager();

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.queryByText(/Available for download/)).toBeNull();
    expect(screen.queryByText('Welcome to Actual')).toBeNull();

    downloadOk = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    await waitFor(() =>
      expect(
        send.mock.calls.filter(c => c[0] === 'download-budget').length,
      ).toBe(2),
    );
    vi.useRealTimers();
  });

  it('shows the file manager after the user closes a file, with no auto-open loop', async () => {
    const store = startedStore();
    await act(async () => {
      await store.dispatch(closeBudget());
    });
    renderManager(store);

    expect(await screen.findByText('Welcome to Actual')).toBeVisible();
    expect(sentNames()).not.toContain('create-budget');
  });

  it('keeps the stock welcome screen when the flag is off', async () => {
    flags.autoOpen = false;
    renderManager();

    expect(await screen.findByText('Welcome to Actual')).toBeVisible();
    expect(sentNames()).not.toContain('create-budget');
  });

  it('sends exactly one load-budget when App start-up opens the last budget', async () => {
    answers = { remoteFiles: [[]], budgets: [{ id: 'b', name: 'B' }] };
    answers.lastOpened = 'b';
    // App start-up: auto-open still waits, the last budget is loading.
    const store = createTestAppStore();
    store.dispatch(setAppState({ loadingText: 'Opening last budget...' }));
    renderManager(store);

    await act(async () => {
      await store.dispatch(loadBudget({ id: 'b' }));
      store.dispatch(allowAutoOpen());
      store.dispatch(setAppState({ loadingText: null }));
    });
    // Give a wrongly started auto-open time to send its own load-budget.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(sentNames().filter(name => name === 'load-budget')).toEqual([
      'load-budget',
    ]);
  });
});
