// Home fork: the deployment sits behind nginx, which already limits each
// client (and only mTLS clients can connect). A fresh client load sends
// 500+ requests in one minute, so the stock global limit of 500 per minute
// returned 429 on the first load. Keep a limit as a safety net, much higher.
export const RATE_LIMIT_DEFAULT_MAX = 5000;
