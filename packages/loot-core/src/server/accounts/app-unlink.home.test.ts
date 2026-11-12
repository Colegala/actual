// @ts-strict-ignore
import * as asyncStorage from '#platform/server/asyncStorage';
import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import * as post from '#server/post';

import { app } from './app';

async function setupGoCardlessAccount() {
  db.runQuery(
    'INSERT INTO banks (id, bank_id, name, tombstone) VALUES (?, ?, ?, 0)',
    ['bank1', 'requisition-1', 'GoCardless bank'],
  );
  await db.insertAccount({
    id: 'acct1',
    name: 'Checking',
    bank: 'bank1',
    account_id: 'ext-1',
    account_sync_source: 'goCardless',
  });
}

describe('unlinking a GoCardless account (home fork)', () => {
  let postSpy;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(asyncStorage.getItem).mockResolvedValue('user-token');
    postSpy = vi.spyOn(post, 'post');
    await global.emptyDatabase()();
    await loadMappings();
    await setupGoCardlessAccount();
  });

  it('unlinks locally and never calls /gocardless/remove-account', async () => {
    await app.handlers['account-unlink']({ id: 'acct1' });

    const account = await db.first<db.DbAccount>(
      'SELECT * FROM accounts WHERE id = ?',
      ['acct1'],
    );
    expect(account.bank).toBeNull();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('closing a linked account never calls /gocardless/remove-account', async () => {
    await app.handlers['account-close']({ id: 'acct1', forced: true });

    expect(postSpy).not.toHaveBeenCalled();
  });
});
