import { fetch } from '#platform/server/fetch';

import { PostError } from './errors';
import { del, get, patch, post, postBinary } from './post';

vi.unmock('#server/post');
vi.mock('#platform/server/fetch', () => ({
  fetch: vi.fn(),
}));

const mockedFetch = vi.mocked(fetch);

const BANK_URLS = [
  'https://cole.local/gocardless/remove-account',
  'https://cole.local/gocardless/status',
  'https://cole.local/simplefin/accounts',
  'https://cole.local/pluggyai/status',
  'https://cole.local/akahu/transactions',
  'https://cole.local/enablebanking/start-auth',
  'https://cole.local/secret',
  'https://cole.local/secret/gocardless_secretId',
  'https://cole.local/cors-proxy?url=x',
];

const calls = [
  ['post', (url: string) => post(url, {})],
  ['get', (url: string) => get(url)],
  ['del', (url: string) => del(url, {})],
  ['patch', (url: string) => patch(url, {})],
  ['postBinary', (url: string) => postBinary(url, new Uint8Array([1]), {})],
] as const;

describe('server requests (home fork: bank sync routes are never called)', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', data: {} }), {
        status: 200,
      }),
    );
  });

  describe.each(calls)('%s', (_name, call) => {
    it.each(BANK_URLS)('rejects %s without a network request', async url => {
      await expect(call(url)).rejects.toBeInstanceOf(PostError);
      expect(mockedFetch).not.toHaveBeenCalled();
    });
  });

  it.each([
    'https://cole.local/sync/sync',
    'https://cole.local/sync/list-user-files',
    'https://cole.local/account/login',
  ])('still sends %s', async url => {
    await post(url, {});
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
