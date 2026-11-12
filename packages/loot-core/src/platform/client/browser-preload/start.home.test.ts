// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startBrowserBackend } from './start';

vi.mock('absurd-sql/dist/indexeddb-main-thread', () => ({
  initBackend: vi.fn(),
}));

class FakeWorker {
  static created: FakeWorker[] = [];
  posted: unknown[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  terminated = false;
  constructor() {
    FakeWorker.created.push(this);
  }
  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  addEventListener() {
    // absurd-sql listens here; nothing to do in the fake
  }
  terminate() {
    this.terminated = true;
  }
}

function fakeSharedWorker() {
  const port = {
    postMessage: vi.fn(),
    start: vi.fn(),
    addEventListener: vi.fn(),
    close: vi.fn(),
  };
  return {
    port,
    onerror: null as ((e: Event) => void) | null,
  };
}

function start(sharedWorker: ReturnType<typeof fakeSharedWorker>) {
  return startBrowserBackend({
    backendWorkerUrl: new URL('http://localhost/worker.js'),
    initPayload: { version: '1', isDev: false },
    createSharedWorker: () => sharedWorker as unknown as SharedWorker,
  });
}

describe('startBrowserBackend (home fork: SharedWorker fallback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWorker.created = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('SharedWorker', class {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses a direct Worker when the SharedWorker reports an error', () => {
    const shared = fakeSharedWorker();
    const socket = start(shared);
    socket.onmessage = vi.fn();

    expect(FakeWorker.created).toHaveLength(0);
    shared.onerror?.(new Event('error'));

    expect(FakeWorker.created).toHaveLength(1);
    expect(FakeWorker.created[0].posted[0]).toMatchObject({ type: 'init' });
    expect(shared.port.close).toHaveBeenCalled();
  });

  it('uses a direct Worker when the SharedWorker sends no connect within 5 s', () => {
    const shared = fakeSharedWorker();
    const socket = start(shared);
    socket.onmessage = vi.fn();

    vi.advanceTimersByTime(5000);

    expect(FakeWorker.created).toHaveLength(1);
    expect(shared.port.postMessage).toHaveBeenCalledWith({
      type: 'tab-closing',
    });

    // A later error does not start a second backend.
    shared.onerror?.(new Event('error'));
    vi.advanceTimersByTime(10_000);
    expect(FakeWorker.created).toHaveLength(1);
  });

  it('stays on the SharedWorker path once it connects', () => {
    const shared = fakeSharedWorker();
    const received: unknown[] = [];
    const socket = start(shared);
    socket.onmessage = e => received.push(e.data);

    const onShared = shared.port.addEventListener.mock.calls[0][1] as (
      e: MessageEvent,
    ) => void;
    onShared({ data: { type: 'connect' } } as MessageEvent);
    vi.advanceTimersByTime(10_000);

    expect(received).toEqual([{ type: 'connect' }]);
    expect(FakeWorker.created).toHaveLength(0);
  });
});
