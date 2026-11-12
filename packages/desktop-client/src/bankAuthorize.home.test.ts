import { describe, expect, it, vi } from 'vitest';

import { authorizeBank as authorizeEnableBanking } from './enablebanking';
import { authorizeBank as authorizeGoCardless } from './gocardless';

// Runs against the real home-fork flags (BANK_SYNC_ENABLED = false).
describe('bank authorization (home fork)', () => {
  it.each([
    ['GoCardless', authorizeGoCardless],
    ['Enable Banking', authorizeEnableBanking],
  ])('%s opens no bank modal when bank sync is disabled', async (_n, fn) => {
    const dispatch = vi.fn();
    await fn(dispatch as never);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
