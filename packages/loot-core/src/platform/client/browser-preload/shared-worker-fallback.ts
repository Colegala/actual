import type { WorkerLike } from './worker-bridge';

type Handler = (e: MessageEvent) => void;

export type FallbackSocketOptions = {
  /** The SharedWorker-backed socket (the WorkerBridge). */
  primary: WorkerLike;
  /** Builds the direct Worker. Called at most once. */
  createFallback: () => WorkerLike;
  /** Cleans up the primary path so it can never start a second backend. */
  abandonPrimary: () => void;
  /** How long to wait for 'connect' once the app starts listening. */
  timeoutMs: number;
  onFallback?: (reason: string) => void;
};

/**
 * Presents one Worker-like socket to the connection layer. Messages go to
 * the SharedWorker path first. If that path reports an error, or sends no
 * 'connect' message within `timeoutMs` after the app starts listening, the
 * socket switches (once) to a direct Worker and drops the SharedWorker path.
 */
export class FallbackSocket implements WorkerLike {
  private readonly opts: FallbackSocketOptions;
  private active: WorkerLike;
  private handler: Handler | null = null;
  private readonly listeners: Handler[] = [];
  private buffered: MessageEvent[] = [];
  private listening = false;
  private connected = false;
  private fellBack = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: FallbackSocketOptions) {
    this.opts = opts;
    this.active = opts.primary;
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
    if (this.fellBack || this.connected) {
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
    const data = e.data as { type?: string } | null;
    if (data && data.type === 'connect') {
      this.connected = true;
      this.clearTimer();
    }
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
