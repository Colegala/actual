import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');

// A send()/sendCatch() call whose first argument is a bank sync handler.
// Each of these handlers makes the backend call a bank route on the server.
const BANK_SEND =
  /send(?:Catch)?\(\s*'((?:gocardless|simplefin|pluggyai|akahu|enablebanking)-[a-z-]+|secret-(?:set|check)|accounts-bank-sync)'/;

/**
 * Every file that sends a bank sync handler, and the gate that keeps it from
 * running when BANK_SYNC_ENABLED is false. A new caller fails this test
 * until it is gated and listed here.
 */
const REVIEWED_CALLERS: Record<string, string> = {
  'accounts/mutations.ts':
    'sync mutations check BANK_SYNC_ENABLED; link mutations run only from the blocked select-linked-accounts modal',
  'components/banksync/useBuiltInBankSyncProviders.ts':
    'used only by the bank sync pages, which BankSyncRoute redirects; its status hooks are gated',
  'components/EnableBankingCallback.tsx': 'route is wrapped in BankSyncRoute',
  'components/Modals.tsx':
    'gocardless-external-msg case is blocked by isBlockedBankSyncModal',
  'components/modals/AkahuInitialiseModal.tsx': 'blocked modal',
  'components/modals/EnableBankingExternalMsgModal.tsx': 'blocked modal',
  'components/modals/EnableBankingInitialiseModal.tsx': 'blocked modal',
  'components/modals/GoCardlessExternalMsgModal.tsx': 'blocked modal',
  'components/modals/GoCardlessInitialiseModal.tsx': 'blocked modal',
  'components/modals/PluggyAiInitialiseModal.tsx': 'blocked modal',
  'components/modals/SimpleFinInitialiseModal.tsx': 'blocked modal',
  'enablebanking.ts': 'sends only from callbacks of blocked modals',
  'gocardless.ts': 'sends only from callbacks of blocked modals',
  'hooks/useAkahuStatus.ts': 'checks BANK_SYNC_ENABLED',
  'hooks/useEnableBankingStatus.ts': 'checks BANK_SYNC_ENABLED',
  'hooks/useGoCardlessStatus.ts': 'checks BANK_SYNC_ENABLED',
  'hooks/usePluggyAiStatus.ts': 'checks BANK_SYNC_ENABLED',
  'hooks/useSimpleFinStatus.ts': 'checks BANK_SYNC_ENABLED',
};

const SELF_GATED = Object.entries(REVIEWED_CALLERS)
  .filter(([, gate]) => gate === 'checks BANK_SYNC_ENABLED')
  .map(([file]) => file);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    const isSource = /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry);
    return isSource ? [path] : [];
  });
}

describe('bank sync callers (home fork)', () => {
  it('lists every file that sends a bank sync handler, so each one is gated', () => {
    const callers = sourceFiles(SRC)
      .filter(file => BANK_SEND.test(readFileSync(file, 'utf8')))
      .map(file => relative(SRC, file).split(sep).join('/'))
      .sort();

    expect(callers).toEqual(Object.keys(REVIEWED_CALLERS).sort());
  });

  it.each(SELF_GATED)('%s checks BANK_SYNC_ENABLED itself', file => {
    expect(readFileSync(join(SRC, file), 'utf8')).toContain(
      'BANK_SYNC_ENABLED',
    );
  });
});
