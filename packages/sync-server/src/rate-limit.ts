import rateLimit from 'express-rate-limit';

import { RATE_LIMIT_DEFAULT_MAX } from './home-fork';

/**
 * Reads the global request limit (per 60 s per client). Only a whole number
 * of at least 1 is valid; anything else keeps the default and warns. The
 * warning never prints the value.
 */
export function resolveRateLimitMax(
  raw: string | number | undefined | null,
  warn: (message: string) => void = console.warn,
): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return RATE_LIMIT_DEFAULT_MAX;
  }
  const text = String(raw).trim();
  const value = Number(text);
  if (/^\d+$/.test(text) && Number.isSafeInteger(value) && value >= 1) {
    return value;
  }
  warn(
    `Invalid ACTUAL_RATE_LIMIT_MAX (must be a whole number of 1 or more); using ${RATE_LIMIT_DEFAULT_MAX}.`,
  );
  return RATE_LIMIT_DEFAULT_MAX;
}

export function createGlobalRateLimiter(max: number) {
  return rateLimit({
    windowMs: 60 * 1000,
    max,
    legacyHeaders: false,
    standardHeaders: true,
  });
}
