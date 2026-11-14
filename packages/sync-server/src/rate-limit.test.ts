import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { config } from './load-config';
import { createGlobalRateLimiter, resolveRateLimitMax } from './rate-limit';

describe('global rate limit (home fork)', () => {
  it('defaults to 5000 per minute', () => {
    expect(config.get('rateLimitMax')).toBe('5000');
    expect(resolveRateLimitMax(config.get('rateLimitMax'))).toBe(5000);
    expect(resolveRateLimitMax(undefined)).toBe(5000);
  });

  it('takes a valid override', () => {
    expect(resolveRateLimitMax('120')).toBe(120);
  });

  it('keeps the default and warns on an invalid value, without echoing it', () => {
    for (const bad of [
      '0',
      '-5',
      '1.5',
      'abc',
      '1e3',
      '99999999999999999999',
    ]) {
      const warn = vi.fn();
      expect(resolveRateLimitMax(bad, warn)).toBe(5000);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0].split(' ')).not.toContain(bad);
    }
  });

  it('does not reject the 501st request in a minute with the defaults', async () => {
    const app = express();
    app.use(createGlobalRateLimiter(resolveRateLimitMax(undefined)));
    app.get('/x', (_req, res) => {
      res.send('ok');
    });

    let last = 0;
    for (let i = 0; i < 501; i++) {
      last = (await request(app).get('/x')).statusCode;
    }
    expect(last).toBe(200);
  });

  it('rejects once the configured max is passed', async () => {
    const app = express();
    app.use(createGlobalRateLimiter(2));
    app.get('/x', (_req, res) => {
      res.send('ok');
    });

    await request(app).get('/x');
    await request(app).get('/x');
    expect((await request(app).get('/x')).statusCode).toBe(429);
  });
});
