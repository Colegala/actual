import * as connection from '@actual-app/core/platform/client/connection';
import type { RemoteFile as ServerFile } from '@actual-app/core/server/cloud-storage';
import type { Budget } from '@actual-app/core/types/budget';
import type { File } from '@actual-app/core/types/file';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setAppState } from '#app/appSlice';
import { createTestAppStore } from '#mocks';
import { setPrefs } from '#prefs/prefsSlice';

import {
  AUTO_OPEN_BUDGET_NAME,
  autoOpenBudget,
  pickBudgetToOpen,
} from './autoOpenBudget';
import { allowAutoOpen, closeBudget, downloadBudget } from './budgetfilesSlice';

// setupTests loads the store (and the real connection) before this file's
// mocks run, so spy on `send` instead of replacing the module.
const send = vi.spyOn(connection, 'send');

type Server = {
  budgets: Budget[];
  remote: Array<ServerFile[] | null>;
  lastOpened: string | null;
  // Per-handler answers that replace the defaults below.
  answers: Record<string, unknown>;
};

let server: Server;

function remoteFile(fileId: string, name = fileId): ServerFile {
  return {
    deleted: false,
    fileId,
    groupId: `group-${fileId}`,
    name,
    encryptKeyId: '',
    hasKey: true,
    owner: '',
    usersWithAccess: [],
  };
}

function mockServer() {
  vi.mocked(send).mockImplementation((async (name: string) => {
    if (name in server.answers) {
      return server.answers[name];
    }
    switch (name) {
      case 'get-budgets':
        return server.budgets;
      case 'get-remote-files':
        // Each call takes the next answer; the last answer repeats.
        return server.remote.length > 1
          ? server.remote.shift()
          : server.remote[0];
      case 'get-last-opened-backup':
        return server.lastOpened;
      case 'load-budget':
      case 'create-budget':
        return {};
      case 'download-budget':
        return { id: 'downloaded-id' };
      case 'load-prefs':
        return { id: 'opened-id' };
      case 'load-global-prefs':
      case 'preferences/get':
        return {};
      default:
        return null;
    }
  }) as unknown as typeof connection.send);
}

/** A store after App start-up finished, so auto-open may run. */
function newStore() {
  const store = createTestAppStore();
  store.dispatch(allowAutoOpen());
  return store;
}

function sentNames() {
  return vi.mocked(send).mock.calls.map(call => call[0]);
}

describe('pickBudgetToOpen (home fork)', () => {
  const local = (id: string, name = id): File => ({
    id,
    name,
    state: 'local',
    hasKey: true,
  });
  const remote = (cloudFileId: string): File => ({
    cloudFileId,
    groupId: 'g',
    name: cloudFileId,
    hasKey: true,
    state: 'remote',
    owner: '',
    usersWithAccess: [],
  });

  it('opens the last-opened budget when it is in the list', () => {
    const files = [local('a'), local('b')];
    expect(pickBudgetToOpen(files, 'b')).toBe(files[1]);
  });

  it('prefers a budget already on this device when the last one is gone', () => {
    const files = [remote('r1'), local('a')];
    expect(pickBudgetToOpen(files, 'missing')).toBe(files[1]);
  });

  it('opens a server-only budget when nothing is on this device', () => {
    const files = [remote('r1')];
    expect(pickBudgetToOpen(files, null)).toBe(files[0]);
  });

  it('never picks a broken file', () => {
    const broken: File = {
      id: 'x',
      name: 'x',
      cloudFileId: 'c',
      groupId: 'g',
      state: 'broken',
      hasKey: true,
      owner: '',
    };
    expect(pickBudgetToOpen([broken], 'x')).toBeNull();
  });
});

describe('autoOpenBudget (home fork)', () => {
  beforeEach(() => {
    vi.mocked(send).mockReset();
    server = { budgets: [], remote: [[]], lastOpened: null, answers: {} };
    mockServer();
  });

  it('opens the last-opened budget straight away', async () => {
    server.budgets = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    server.lastOpened = 'b';
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('opened');
    expect(send).toHaveBeenCalledWith('load-budget', { id: 'b' });
    expect(sentNames()).not.toContain('create-budget');
    expect(store.getState().budgetfiles.autoOpen).toBe('done');
  });

  it('downloads and opens a budget that is only on the server', async () => {
    server.remote = [[remoteFile('cloud-1', 'Shared')]];
    const store = newStore();

    await store.dispatch(autoOpenBudget());

    expect(send).toHaveBeenCalledWith('download-budget', {
      cloudFileId: 'cloud-1',
      localId: undefined,
    });
    expect(sentNames()).not.toContain('create-budget');
  });

  it(`creates one "${AUTO_OPEN_BUDGET_NAME}" budget when the server has none`, async () => {
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('created');
    const creates = vi
      .mocked(send)
      .mock.calls.filter(call => call[0] === 'create-budget');
    expect(creates).toEqual([
      ['create-budget', { testMode: false, budgetName: 'My Budget' }],
    ]);
    // The list is checked again right before the create.
    const beforeCreate = sentNames().slice(
      0,
      sentNames().indexOf('create-budget'),
    );
    expect(beforeCreate.filter(name => name === 'get-remote-files')).toEqual([
      'get-remote-files',
      'get-remote-files',
    ]);
  });

  it('does not create a duplicate when the re-check finds a new budget', async () => {
    server.remote = [[], [remoteFile('cloud-2')]];
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('opened');
    expect(sentNames()).not.toContain('create-budget');
    expect(sentNames()).toContain('download-budget');
  });

  it('reports a failure, and creates nothing, when the file list fails and nothing is on this device', async () => {
    server.remote = [null];
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(sentNames()).not.toContain('create-budget');
    expect(store.getState().budgetfiles.autoOpen).toBe('failed');
    expect(store.getState().app.loadingText).toBeNull();
  });

  it('reports a failure when the backend throws', async () => {
    vi.mocked(send).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(store.getState().budgetfiles.autoOpen).toBe('failed');
  });

  it('can retry after a failure', async () => {
    server.remote = [null, []];
    const store = newStore();

    await store.dispatch(autoOpenBudget());
    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('created');
  });

  it('runs once even when started twice, so only one budget is created', async () => {
    const store = newStore();

    await Promise.all([
      store.dispatch(autoOpenBudget()),
      store.dispatch(autoOpenBudget()),
    ]);
    await store.dispatch(autoOpenBudget());

    expect(sentNames().filter(name => name === 'create-budget')).toHaveLength(
      1,
    );
  });

  it('closing a file turns auto-open off for this page load, so the file list stays reachable', async () => {
    const store = newStore();

    await store.dispatch(closeBudget());
    vi.mocked(send).mockClear();
    await store.dispatch(autoOpenBudget());

    expect(store.getState().budgetfiles.autoOpen).toBe('done');
    expect(sentNames()).toEqual([]);
  });

  it('opens a budget on this device when the file list fails (offline use)', async () => {
    server.remote = [null];
    server.budgets = [{ id: 'local-1', name: 'Mine' }];
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('opened');
    expect(send).toHaveBeenCalledWith('load-budget', { id: 'local-1' });
    expect(store.getState().budgetfiles.autoOpen).toBe('done');
  });

  it('reports a failure, not done, when the remote-only download fails (429/5xx)', async () => {
    server.remote = [[remoteFile('cloud-1', 'Shared')]];
    server.answers['download-budget'] = {
      error: { reason: 'network' },
    };
    vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(store.getState().budgetfiles.autoOpen).toBe('failed');
    expect(sentNames()).not.toContain('create-budget');
  });

  it('shows no alert() popup when auto-open fails, but still does when the user downloads by hand', async () => {
    server.remote = [[remoteFile('cloud-1', 'Shared')]];
    server.answers['download-budget'] = {
      error: { reason: 'network' },
    };
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    const store = newStore();

    await store.dispatch(autoOpenBudget());
    await store.dispatch(autoOpenBudget());
    expect(alertSpy).not.toHaveBeenCalled();

    await store.dispatch(downloadBudget({ cloudFileId: 'cloud-1' }));
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('ends in a terminal error, not a retry, for a non-network load error', async () => {
    server.remote = [null];
    server.budgets = [{ id: 'local-1', name: 'Mine' }];
    server.answers['load-budget'] = { error: 'budget-not-found' };
    server.answers['load-prefs'] = {};
    vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('error');
    expect(store.getState().budgetfiles.autoOpen).toBe('error');
  });

  it('ends in a terminal error for download errors that are not network errors', async () => {
    for (const reason of [
      'mismatched-cloud-file',
      'invalid-zip-file',
      'invalid-meta-file',
      'invalid-schema',
    ]) {
      server.remote = [[remoteFile('cloud-1', 'Shared')]];
      server.answers['download-budget'] = { error: { reason } };
      const store = newStore();
      const result = await store.dispatch(autoOpenBudget()).unwrap();
      expect(result).toBe('error');
    }
  });

  it('treats every other download failure as a network problem to retry', async () => {
    for (const reason of [
      'internal',
      'network-failure',
      'download-failure',
      'network',
      'Too many requests, please try again later.',
      '<html><body>502 Bad Gateway</body></html>',
      'some-unknown-reason',
    ]) {
      server.remote = [[remoteFile('cloud-1', 'Shared')]];
      server.answers['download-budget'] = { error: { reason } };
      const store = newStore();
      const result = await store.dispatch(autoOpenBudget()).unwrap();
      expect(result, reason).toBe('failed');
      expect(store.getState().budgetfiles.autoOpen).toBe('failed');
    }
  });

  it('does not replace a file or alert when the download says file-exists', async () => {
    server.remote = [[remoteFile('cloud-1', 'Shared')]];
    server.answers['download-budget'] = {
      error: { reason: 'file-exists', meta: { id: 'x', name: 'y' } },
    };
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('error');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(sentNames().filter(n => n === 'download-budget')).toHaveLength(1);
  });

  it('shows no alert() popup when a local budget fails to load during auto-open', async () => {
    server.remote = [null];
    server.budgets = [{ id: 'local-1', name: 'Mine' }];
    server.answers['load-budget'] = { error: 'out-of-sync-data' };
    server.answers['load-prefs'] = {};
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(vi.fn());
    const store = newStore();

    await store.dispatch(autoOpenBudget());

    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('downloads and opens the remote-only file on a later retry', async () => {
    server.remote = [[remoteFile('cloud-1', 'Shared')]];
    server.answers['download-budget'] = {
      error: { reason: 'network' },
    };
    vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    const store = newStore();
    await store.dispatch(autoOpenBudget());

    delete server.answers['download-budget'];
    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('opened');
    expect(store.getState().budgetfiles.autoOpen).toBe('done');
  });

  it('needs the user (newer app) when the local budget is out of sync', async () => {
    server.remote = [null];
    server.budgets = [{ id: 'local-1', name: 'Mine' }];
    server.answers['load-budget'] = { error: 'out-of-sync-data' };
    server.answers['load-prefs'] = {};
    vi.spyOn(window, 'alert').mockImplementation(vi.fn());
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('needs-user');
  });

  it('never creates a budget when the file list throws', async () => {
    send.mockImplementation((async (name: string) => {
      if (name === 'get-remote-files') {
        throw new Error('HTTP 429');
      }
      return name === 'get-budgets' ? [] : null;
    }) as unknown as typeof connection.send);
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(sentNames()).not.toContain('create-budget');
  });

  it('waits for App start-up before it runs', async () => {
    const store = createTestAppStore();

    await store.dispatch(autoOpenBudget());

    expect(sentNames()).toEqual([]);
    expect(store.getState().budgetfiles.autoOpen).toBe('waiting');
  });

  it('does not run while another load is running', async () => {
    const store = newStore();
    store.dispatch(setAppState({ loadingText: 'Opening last budget...' }));

    await store.dispatch(autoOpenBudget());

    expect(sentNames()).toEqual([]);
  });

  it('does not load a second time when a budget is already open', async () => {
    server.budgets = [{ id: 'b', name: 'B' }];
    const store = newStore();
    store.dispatch(
      setPrefs({ local: { id: 'b' }, global: {}, synced: {} } as never),
    );

    await store.dispatch(autoOpenBudget());

    expect(sentNames()).not.toContain('load-budget');
  });

  it('shows Retry, not the welcome screen, when create-budget fails', async () => {
    server.answers['create-budget'] = { error: 'internal' };
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(store.getState().budgetfiles.autoOpen).toBe('failed');
  });

  it('shows Retry when the new budget did not reach the server; two devices creating at the same moment can still both create (no server lock)', async () => {
    server.answers['load-prefs'] = { id: 'my-budget' };
    server.answers['upload-budget'] = { error: { reason: 'network-failure' } };
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(sentNames()).toContain('upload-budget');
    expect(sentNames()).toContain('close-budget');
    expect(store.getState().budgetfiles.autoOpen).toBe('failed');
  });

  it('treats the budget as created once its upload succeeded', async () => {
    server.answers['load-prefs'] = { id: 'my-budget', cloudFileId: 'cloud-1' };
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('created');
    expect(sentNames()).not.toContain('upload-budget');
  });

  it('on Retry uploads the earlier un-uploaded budget instead of creating a second one', async () => {
    server.budgets = [{ id: 'my-budget', name: 'My Budget' }];
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('opened');
    expect(send).toHaveBeenCalledWith('upload-budget', { id: 'my-budget' });
    expect(send).toHaveBeenCalledWith('load-budget', { id: 'my-budget' });
    expect(sentNames()).not.toContain('create-budget');
  });

  it('shows Retry when that upload fails again', async () => {
    server.budgets = [{ id: 'my-budget', name: 'My Budget' }];
    server.answers['upload-budget'] = { error: { reason: 'network-failure' } };
    const store = newStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(sentNames()).not.toContain('load-budget');
  });
});
