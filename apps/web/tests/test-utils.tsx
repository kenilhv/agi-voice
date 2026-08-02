import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import type { SseEvent } from '@voicefuzz/contracts';
import { RunStreamProvider, type StreamHandlers, type StreamTransport } from '@/lib/run-stream';

export const TEST_RUN_ID = 'test-run-1';

/** A transport the test drives by hand, standing in for EventSource. */
export function createFakeTransport() {
  let handlers: StreamHandlers | null = null;
  let subscribeCount = 0;
  let unsubscribeCount = 0;

  const transport: StreamTransport = {
    subscribe(_url, incoming) {
      handlers = incoming;
      subscribeCount += 1;
      return () => {
        // Like EventSource.close(): no further frames reach the consumer.
        handlers = null;
        unsubscribeCount += 1;
      };
    },
  };

  return {
    transport,
    get subscribeCount() {
      return subscribeCount;
    },
    get unsubscribeCount() {
      return unsubscribeCount;
    },
    open() {
      act(() => handlers?.onOpen());
    },
    emit(event: SseEvent) {
      act(() => handlers?.onMessage(JSON.stringify(event)));
    },
    emitRaw(data: string) {
      act(() => handlers?.onMessage(data));
    },
    fail() {
      act(() => handlers?.onError());
    },
  };
}

/** Let pending effects (such as the failure detail re-fetch) settle before asserting. */
export async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export function renderInRunStream(
  ui: ReactNode,
  options?: { transport?: StreamTransport; demoMode?: boolean; runId?: string },
) {
  const transport = options?.transport ?? createFakeTransport().transport;
  return render(
    <RunStreamProvider
      runId={options?.runId ?? TEST_RUN_ID}
      transport={transport}
      demoMode={options?.demoMode ?? false}
      fixtureStepMs={0}
    >
      {ui}
    </RunStreamProvider>,
  );
}
