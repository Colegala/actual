import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Every route that renders a bank sync page must be wrapped in BankSyncRoute.
describe('FinancesApp (home fork: bank sync routes gated)', () => {
  const source = readFileSync(resolve(__dirname, 'FinancesApp.tsx'), 'utf8');
  const routes = source.split('<Route').slice(1);

  it.each([
    'path="/bank-sync/account/:accountId/edit"',
    'path="/bank-sync"',
    'path="bank-sync"',
    'path="/gocardless/link"',
    'path="/enablebanking/auth_callback"',
  ])('wraps %s in BankSyncRoute', pathAttr => {
    const route = routes.find(r => r.includes(pathAttr));
    expect(route).toBeDefined();
    expect(route).toContain('<BankSyncRoute>');
  });

  it('wraps every route that renders a bank sync page', () => {
    const offenders = routes.filter(
      r =>
        /name="BankSync"|MobileBankSync\w*Page|GoCardlessLink|EnableBankingCallback/.test(
          r,
        ) && !r.includes('<BankSyncRoute>'),
    );
    expect(offenders).toEqual([]);
  });
});
