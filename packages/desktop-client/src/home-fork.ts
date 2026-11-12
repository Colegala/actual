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

/**
 * nginx injects the x-actual-password header and the server uses
 * ACTUAL_LOGIN_METHOD=header, so the client signs in with the header login
 * method automatically and never shows a password field.
 */
export const HOME_HEADER_LOGIN = true;

/**
 * The custom theme catalog (fetched from raw.githubusercontent.com) is hidden
 * and never requested. Built-in themes and pasted CSS still work.
 */
export const THEME_CATALOG_ENABLED = false;

/**
 * After sign-in the app opens a budget straight away: the last-opened one,
 * else another one on the server, else it creates "My Budget". The welcome
 * screen and the file list only show after the user closes a file. The
 * first-run tour offer is skipped.
 */
export const AUTO_OPEN_BUDGET = true;
