import { BANK_SYNC_ENABLED } from '#home-fork';

/**
 * Home fork: modals that talk to bank sync routes on the server
 * (gocardless, simplefin, pluggyai, akahu, enablebanking, secret). nginx
 * answers those routes with 403, so these modals never render when bank sync
 * is disabled.
 */
export const BANK_SYNC_MODALS: ReadonlySet<string> = new Set([
  'select-linked-accounts',
  'gocardless-init',
  'simplefin-init',
  'pluggyai-init',
  'akahu-init',
  'enablebanking-init',
  'enablebanking-external-msg',
  'gocardless-external-msg',
]);

export function isBlockedBankSyncModal(name: string): boolean {
  return !BANK_SYNC_ENABLED && BANK_SYNC_MODALS.has(name);
}
