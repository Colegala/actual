// @ts-strict-ignore
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createCoordinator } from './coordinator';

type MockPort = {
  postMessage: Mock;
  start: Mock;
  onmessage: ((event: { data: unknown }) => void) | null;
};

function connectTab(coordinator: ReturnType<typeof createCoordinator>) {
  const port: MockPort = {
    postMessage: vi.fn(),
    start: vi.fn(),
    onmessage: null,
  };
  coordinator.onconnect({ ports: [port] });
  return port;
}

function sendMsg(port: MockPort, msg: Record<string, unknown>) {
  port.onmessage!({ data: msg });
}

function roleChanges(port: MockPort) {
  return port.postMessage.mock.calls
    .map(([msg]) => msg)
    .filter(msg => msg.type === '__role-change');
}

describe('coordinator (home fork: repeated load-budget from the leader)', () => {
  let coordinator: ReturnType<typeof createCoordinator>;

  beforeEach(() => {
    vi.useFakeTimers();
    coordinator = createCoordinator();
  });

  afterEach(() => {
    coordinator.destroy();
    vi.useRealTimers();
  });

  function leadBudget(budgetId: string, connected: boolean) {
    const leader = connectTab(coordinator);
    sendMsg(leader, { type: 'init', version: '1.0', isDev: false });
    sendMsg(leader, {
      id: 'lb-1',
      name: 'load-budget',
      args: { id: budgetId },
    });
    if (connected) {
      sendMsg(leader, { type: '__from-worker', msg: { type: 'connect' } });
      sendMsg(leader, {
        type: '__from-worker',
        msg: { type: 'reply', id: 'lb-1', result: {} },
      });
    }
    leader.postMessage.mockClear();
    return leader;
  }

  it.each([
    ['after the backend connected', true],
    ['while the backend is still booting', false],
  ])(
    'keeps the leader a LEADER when it loads its own budget again %s',
    (_when, connected) => {
      const leader = leadBudget('budget-1', connected);

      sendMsg(leader, {
        id: 'lb-2',
        name: 'load-budget',
        args: { id: 'budget-1' },
      });

      // The leader is never demoted to a follower of itself (that would
      // terminate its only backend Worker); the request still reaches it.
      expect(roleChanges(leader)).toEqual([]);
      expect(leader.postMessage).toHaveBeenCalledWith({
        type: '__to-worker',
        msg: expect.objectContaining({ id: 'lb-2', name: 'load-budget' }),
      });
    },
  );
});
