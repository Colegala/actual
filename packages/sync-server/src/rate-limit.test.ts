import convict from 'convict';
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

  it('loads a number, a string or garbage from config.json without throwing', () => {
    const load = (value: unknown) => {
      const schema = convict({
        rateLimitMax: {
          format: 'rateLimitMax',
          default: '5000',
          env: 'TEST_NO_SUCH_ENV',
        },
      });
      schema.load({ rateLimitMax: value } as never);
      expect(() => schema.validate({ allowed: 'strict' })).not.toThrow();
      return schema.get('rateLimitMax');
    };
    const warn = vi.fn();

    expect(resolveRateLimitMax(load(7000), warn)).toBe(7000);
    expect(resolveRateLimitMax(load('8000'), warn)).toBe(8000);
    expect(warn).not.toHaveBeenCalled();
    expect(resolveRateLimitMax(load(true), warn)).toBe(5000);
    expect(resolveRateLimitMax(load('garbage'), warn)).toBe(5000);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('takes a valid override', () => {
    expect(resolveRateLimitMax('120')).toBe(120);
  });

  it('keeps the default and warns on an invalid value, without echoing it', () => {
    for (const bad of ['-5', '1.5', 'abcdef', '1e3', '99999999999999999999']) {
      const warn = vi.fn();
      expect(resolveRateLimitMax(bad, warn)).toBe(5000);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).not.toContain(bad);
    }
  });

  it('rejects 0 as invalid', () => {
    const warn = vi.fn();
    expect(resolveRateLimitMax('0', warn)).toBe(5000);
    expect(warn).toHaveBeenCalledTimes(1);
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
