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

import { AuthProvider } from '#auth/AuthProvider';
import { closeBudget } from '#budgetfiles/budgetfilesSlice';
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
        return [];
      case 'get-remote-files':
        return answers.remoteFiles.length > 1
          ? answers.remoteFiles.shift()
          : answers.remoteFiles[0];
      case 'get-last-opened-backup':
        return null;
      case 'create-budget':
        answers.screenAtCreate = document.body.textContent ?? '';
        return {};
      case 'load-prefs':
      case 'load-global-prefs':
      case 'preferences/get':
        return {};
      default:
        return null;
    }
  }) as unknown as typeof connection.send);
}

function renderManager(store = createTestAppStore()) {
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

  it('shows the file manager after the user closes a file, with no auto-open loop', async () => {
    const store = createTestAppStore();
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
});
