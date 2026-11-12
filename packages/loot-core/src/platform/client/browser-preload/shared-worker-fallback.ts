import type { WorkerLike } from './worker-bridge';

type Handler = (e: MessageEvent) => void;

export type FallbackSocketOptions = {
  /** The SharedWorker-backed socket (the WorkerBridge). */
  primary: WorkerLike;
  /** Builds the direct Worker. Called at most once. */
  createFallback: () => WorkerLike;
  /** Cleans up the primary path so it can never start a second backend. */
  abandonPrimary: () => void;
  /**
   * How long to wait, once the app starts listening, for the first message
   * of any kind from the SharedWorker coordinator.
   */
  timeoutMs: number;
  onFallback?: (reason: string) => void;
};

/**
 * Presents one Worker-like socket to the connection layer. Messages go to
 * the SharedWorker path first. The socket switches (once) to a direct Worker
 * only while the SharedWorker has shown no sign of life: on its error event,
 * or when no message at all arrives within `timeoutMs` after the app starts
 * listening. The coordinator answers a new tab at once (role change,
 * heartbeat), so a live SharedWorker never falls back, however long the
 * backend download and wasm start-up take. That keeps a slow but healthy
 * tab on the coordinator, so it cannot run a second backend on a budget.
 */
export class FallbackSocket implements WorkerLike {
  private readonly opts: FallbackSocketOptions;
  private active: WorkerLike;
  private handler: Handler | null = null;
  private readonly listeners: Handler[] = [];
  private buffered: MessageEvent[] = [];
  private listening = false;
  private alive = false;
  private fellBack = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: FallbackSocketOptions) {
    this.opts = opts;
    this.active = opts.primary;
  }

  /** The SharedWorker sent a message, so it is running. */
  markAlive() {
    if (this.fellBack) {
      return;
    }
    this.alive = true;
    this.clearTimer();
  }

  get usingFallback() {
    return this.fellBack;
  }

  set onmessage(handler: Handler | null) {
    this.handler = handler;
    const buffered = this.buffered;
    this.buffered = [];
    buffered.forEach(e => this.dispatch(e));
    this.listen();
  }

  get onmessage() {
    return this.handler;
  }

  postMessage(msg: unknown) {
    this.active.postMessage(msg);
  }

  addEventListener(type: string, handler: Handler) {
    if (type === 'message') {
      this.listeners.push(handler);
    }
  }

  start() {
    this.listen();
  }

  terminate() {
    this.clearTimer();
    this.active.terminate?.();
  }

  /** Switch to the direct Worker. Safe to call more than once. */
  fallback(reason: string) {
    if (this.fellBack || this.alive) {
      return;
    }
    this.fellBack = true;
    this.clearTimer();
    this.opts.onFallback?.(reason);
    this.opts.abandonPrimary();

    const worker = this.opts.createFallback();
    worker.onmessage = e => this.dispatch(e);
    this.active = worker;
  }

  private listen() {
    if (this.listening || this.fellBack) {
      return;
    }
    this.listening = true;
    this.opts.primary.onmessage = e => this.fromPrimary(e);
    this.timer = setTimeout(
      () => this.fallback('timeout'),
      this.opts.timeoutMs,
    );
  }

  private fromPrimary(e: MessageEvent) {
    if (this.fellBack) {
      return;
    }
    this.markAlive();
    this.dispatch(e);
  }

  private dispatch(e: MessageEvent) {
    if (!this.handler && this.listeners.length === 0) {
      this.buffered.push(e);
      return;
    }
    this.handler?.(e);
    this.listeners.forEach(listener => listener(e));
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
