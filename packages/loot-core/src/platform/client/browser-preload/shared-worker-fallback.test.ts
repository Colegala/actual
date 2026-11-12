import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FallbackSocket } from './shared-worker-fallback';
import type { WorkerLike } from './worker-bridge';

type FakeSocket = WorkerLike & {
  posted: unknown[];
  emit: (data: unknown) => void;
  terminated: boolean;
};

function fakeSocket(): FakeSocket {
  const socket: FakeSocket = {
    onmessage: null,
    posted: [],
    terminated: false,
    postMessage(msg: unknown) {
      socket.posted.push(msg);
    },
    addEventListener() {
      // not used by FallbackSocket
    },
    terminate() {
      socket.terminated = true;
    },
    emit(data: unknown) {
      socket.onmessage?.({ data } as MessageEvent);
    },
  };
  return socket;
}

function setup() {
  const primary = fakeSocket();
  const fallbacks: FakeSocket[] = [];
  const abandonPrimary = vi.fn();
  const socket = new FallbackSocket({
    primary,
    createFallback: () => {
      const worker = fakeSocket();
      fallbacks.push(worker);
      return worker;
    },
    abandonPrimary,
    timeoutMs: 10_000,
  });
  const received: unknown[] = [];
  return { primary, fallbacks, abandonPrimary, socket, received };
}

describe('FallbackSocket (SharedWorker to direct Worker fallback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the SharedWorker path when it connects in time', () => {
    const { primary, fallbacks, socket, received } = setup();
    socket.onmessage = e => received.push(e.data);

    primary.emit({ type: 'connect' });
    vi.advanceTimersByTime(10_000);

    expect(received).toEqual([{ type: 'connect' }]);
    expect(fallbacks).toHaveLength(0);
    expect(socket.usingFallback).toBe(false);
  });

  it('falls back to a direct Worker after 10 s with no message at all', () => {
    const { primary, fallbacks, abandonPrimary, socket, received } = setup();
    socket.onmessage = e => received.push(e.data);

    vi.advanceTimersByTime(9999);
    expect(fallbacks).toHaveLength(0);
    vi.advanceTimersByTime(1);

    expect(fallbacks).toHaveLength(1);
    expect(abandonPrimary).toHaveBeenCalledTimes(1);

    fallbacks[0].emit({ type: 'connect' });
    socket.postMessage({ name: 'ping' });

    expect(received).toEqual([{ type: 'connect' }]);
    expect(fallbacks[0].posted).toEqual([{ name: 'ping' }]);
    expect(primary.posted).toEqual([]);
  });

  it('does not start the timer before the app listens', () => {
    const { fallbacks, socket } = setup();

    vi.advanceTimersByTime(60_000);
    expect(fallbacks).toHaveLength(0);

    socket.start();
    vi.advanceTimersByTime(10_000);
    expect(fallbacks).toHaveLength(1);
  });

  it('falls back once only, so two backends never start', () => {
    const { primary, fallbacks, abandonPrimary, socket, received } = setup();
    socket.onmessage = e => received.push(e.data);

    socket.fallback('error');
    socket.fallback('error');
    vi.advanceTimersByTime(10_000);

    expect(fallbacks).toHaveLength(1);
    expect(abandonPrimary).toHaveBeenCalledTimes(1);

    // A late connect from the abandoned SharedWorker path is ignored.
    primary.emit({ type: 'connect' });
    expect(received).toEqual([]);
  });

  it('ignores an error after the SharedWorker path connected', () => {
    const { primary, fallbacks, socket } = setup();
    socket.onmessage = vi.fn();
    primary.emit({ type: 'connect' });

    socket.fallback('error');

    expect(fallbacks).toHaveLength(0);
  });

  it('keeps messages from the direct Worker until the app listens', () => {
    const { fallbacks, socket, received } = setup();

    socket.fallback('error');
    fallbacks[0].emit({ type: 'connect' });
    socket.onmessage = e => received.push(e.data);

    expect(received).toEqual([{ type: 'connect' }]);
  });

  it('never falls back while a live SharedWorker is slow to start the backend', () => {
    const { fallbacks, socket } = setup();
    socket.onmessage = vi.fn();

    // The coordinator answered (role change, heartbeat), so it is alive;
    // backend download and wasm start-up may take as long as they need.
    socket.markAlive();
    vi.advanceTimersByTime(120_000);

    expect(fallbacks).toHaveLength(0);
  });

  it('ignores an error once the SharedWorker is alive, so two backends never run', () => {
    const { fallbacks, socket } = setup();
    socket.onmessage = vi.fn();
    socket.markAlive();

    socket.fallback('error');

    expect(fallbacks).toHaveLength(0);
  });
});
