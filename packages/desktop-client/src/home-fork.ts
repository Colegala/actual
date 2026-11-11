// Private home fork: local-only settings. Kept in one file so upstream
// rebases stay easy.

/** Where the "Home" button points (opened in the same tab). */
export const HOME_URL = 'https://cole.local/';

/** Bank sync (GoCardless, SimpleFIN, Pluggy, Akahu, Enable Banking) is hidden. */
export const BANK_SYNC_ENABLED = false;

/** The in-app news feed (fetched from GitHub) is forced off. */
export const NEWS_FEED_ENABLED = false;

/** No outbound "latest version" lookup and no update notifications. */
export const VERSION_CHECK_ENABLED = false;
