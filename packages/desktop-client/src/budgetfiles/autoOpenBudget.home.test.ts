import * as connection from '@actual-app/core/platform/client/connection';
import type { RemoteFile as ServerFile } from '@actual-app/core/server/cloud-storage';
import type { Budget } from '@actual-app/core/types/budget';
import type { File } from '@actual-app/core/types/file';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestAppStore } from '#mocks';

import {
  AUTO_OPEN_BUDGET_NAME,
  autoOpenBudget,
  pickBudgetToOpen,
} from './autoOpenBudget';
import { closeBudget } from './budgetfilesSlice';

// setupTests loads the store (and the real connection) before this file's
// mocks run, so spy on `send` instead of replacing the module.
const send = vi.spyOn(connection, 'send');

type Server = {
  budgets: Budget[];
  remote: Array<ServerFile[] | null>;
  lastOpened: string | null;
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
    server = { budgets: [], remote: [[]], lastOpened: null };
    mockServer();
  });

  it('opens the last-opened budget straight away', async () => {
    server.budgets = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    server.lastOpened = 'b';
    const store = createTestAppStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('opened');
    expect(send).toHaveBeenCalledWith('load-budget', { id: 'b' });
    expect(sentNames()).not.toContain('create-budget');
    expect(store.getState().budgetfiles.autoOpen).toBe('done');
  });

  it('downloads and opens a budget that is only on the server', async () => {
    server.remote = [[remoteFile('cloud-1', 'Shared')]];
    const store = createTestAppStore();

    await store.dispatch(autoOpenBudget());

    expect(send).toHaveBeenCalledWith('download-budget', {
      cloudFileId: 'cloud-1',
      localId: undefined,
    });
    expect(sentNames()).not.toContain('create-budget');
  });

  it(`creates one "${AUTO_OPEN_BUDGET_NAME}" budget when the server has none`, async () => {
    const store = createTestAppStore();

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
    const store = createTestAppStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('opened');
    expect(sentNames()).not.toContain('create-budget');
    expect(sentNames()).toContain('download-budget');
  });

  it('reports a failure, and creates nothing, when the file list call fails', async () => {
    server.remote = [null];
    const store = createTestAppStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(sentNames()).not.toContain('create-budget');
    expect(store.getState().budgetfiles.autoOpen).toBe('failed');
    expect(store.getState().app.loadingText).toBeNull();
  });

  it('reports a failure when the backend throws', async () => {
    vi.mocked(send).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
    const store = createTestAppStore();

    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('failed');
    expect(store.getState().budgetfiles.autoOpen).toBe('failed');
  });

  it('can retry after a failure', async () => {
    server.remote = [null, []];
    const store = createTestAppStore();

    await store.dispatch(autoOpenBudget());
    const result = await store.dispatch(autoOpenBudget()).unwrap();

    expect(result).toBe('created');
  });

  it('runs once even when started twice, so only one budget is created', async () => {
    const store = createTestAppStore();

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
    const store = createTestAppStore();

    await store.dispatch(closeBudget());
    vi.mocked(send).mockClear();
    await store.dispatch(autoOpenBudget());

    expect(store.getState().budgetfiles.autoOpen).toBe('done');
    expect(sentNames()).toEqual([]);
  });
});
