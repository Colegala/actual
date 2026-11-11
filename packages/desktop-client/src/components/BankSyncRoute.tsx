import type { ReactElement } from 'react';
import { Navigate } from 'react-router';

import { BANK_SYNC_ENABLED } from '#home-fork';

// Home fork: bank sync pages are not reachable when bank sync is disabled.
// Redirect to the budget instead of rendering the page.
export function BankSyncRoute({ children }: { children: ReactElement }) {
  if (!BANK_SYNC_ENABLED) {
    return <Navigate to="/budget" replace />;
  }

  return children;
}
