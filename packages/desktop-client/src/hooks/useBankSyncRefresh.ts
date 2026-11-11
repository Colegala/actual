import { useCallback } from 'react';

import { useSyncAndDownloadMutation } from '#accounts';
import { BANK_SYNC_ENABLED } from '#home-fork';

/**
 * Pull-to-refresh handler for the mobile account screens. Syncs one account
 * (or all accounts without an id). Home fork: undefined when bank sync is
 * disabled, so the screens are not pullable and nothing is sent.
 */
export function useBankSyncRefresh(id?: string) {
  const syncAndDownload = useSyncAndDownloadMutation();
  const onRefresh = useCallback(() => {
    syncAndDownload.mutate(id ? { id } : {});
  }, [id, syncAndDownload]);

  return BANK_SYNC_ENABLED ? onRefresh : undefined;
}
