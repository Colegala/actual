// Private home fork: backend-side settings. Keep BANK_SYNC_ENABLED equal to
// the flag of the same name in packages/desktop-client/src/home-fork.ts.

/**
 * Bank sync is off. nginx answers the bank routes with 403 (and fail2ban
 * bans on 403), so the backend never sends a request to them.
 */
export const BANK_SYNC_ENABLED = false;

const BANK_ROUTE =
  /\/(?:gocardless|simplefin|pluggyai|akahu|enablebanking|secret|cors-proxy)(?:\/|$)/;

/** True when `url` is a bank sync route that must not be requested. */
export function isBlockedBankRoute(url: unknown): boolean {
  if (BANK_SYNC_ENABLED) {
    return false;
  }
  const href =
    typeof url === 'string'
      ? url
      : url && typeof url === 'object' && 'url' in url
        ? String((url as { url: unknown }).url)
        : String(url);
  let path = href;
  try {
    path = new URL(href).pathname;
  } catch {
    // Not an absolute URL: test the string as given.
  }
  return BANK_ROUTE.test(path);
}
