'use client';

/**
 * Live run stream.
 *
 * Owns one SSE subscription per run and accumulates the documented `SseEvent`
 * payloads into a snapshot the run screens read. The backend replays a run's full
 * event history on connect, so a reconnect is lossless and late viewers still see
 * the whole story.
 *
 * The transport is injectable so tests can drive the state machine without a real
 * EventSource (jsdom does not implement one).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SseEventSchema, type SseEvent } from '@voicefuzz/contracts';
import { runEventsUrl } from './api';
import { DEMO_MODE } from './config';
import { DEMO_FIXTURE_EVENTS } from './fixtures';
import { dedupeById, isTerminalState, type RunSnapshot } from './derive';

export type ConnectionStatus =
  'connecting' | 'open' | 'reconnecting' | 'closed' | 'offline' | 'fixture';

export interface StreamHandlers {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onError: () => void;
}

export interface StreamTransport {
  /** Subscribe to a URL. Returns an unsubscribe function. */
  subscribe: (url: string, handlers: StreamHandlers) => () => void;
}

const defaultTransport: StreamTransport = {
  subscribe(url, handlers) {
    const source = new EventSource(url);
    source.onopen = () => handlers.onOpen();
    source.onmessage = (message: MessageEvent<string>) => handlers.onMessage(message.data);
    source.onerror = () => handlers.onError();
    return () => source.close();
  },
};

export interface RunStreamValue extends RunSnapshot {
  runId: string;
  connection: ConnectionStatus;
  usingFixture: boolean;
  eventCount: number;
  retry: () => void;
}

const RunStreamContext = createContext<RunStreamValue | null>(null);

const MAX_RECONNECT_ATTEMPTS = 3;

/** Upper bound on retained transcript frames, so a replayed history cannot grow without limit. */
const MAX_TIMELINE_EVENTS = 500;

const EMPTY_SNAPSHOT: RunSnapshot = {
  state: 'queued',
  progress: { total: 0, completed: 0, message: 'connecting' },
  results: [],
  failures: [],
  timeline: [],
};

export function RunStreamProvider({
  runId,
  children,
  transport = defaultTransport,
  /** Fixture replay cadence in ms; 0 replays synchronously (used by tests). */
  fixtureStepMs = 140,
  demoMode = DEMO_MODE,
}: {
  runId: string;
  children: ReactNode;
  transport?: StreamTransport;
  fixtureStepMs?: number;
  demoMode?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<RunSnapshot>(EMPTY_SNAPSHOT);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [usingFixture, setUsingFixture] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const attemptsRef = useRef(0);
  const openedRef = useRef(false);
  const terminalRef = useRef(false);

  const applyEvent = useCallback((event: SseEvent) => {
    setEventCount((count) => count + 1);
    setSnapshot((previous) => {
      const next: RunSnapshot = {
        ...previous,
        state: event.state,
        progress: event.progress,
      };
      if (event.timeline) {
        // Bounded: a reconnect replays the run's whole history, and a long run emits
        // several frames per case, so the transcript keeps only a recent window.
        next.timeline = [...previous.timeline, event.timeline].slice(-MAX_TIMELINE_EVENTS);
      }
      if (event.result) {
        next.results = dedupeById([...previous.results, event.result]);
      }
      if (event.failure) {
        next.failures = dedupeById([...previous.failures, event.failure]);
      }
      if (event.counterexample) {
        next.counterexample = event.counterexample;
      }
      if (event.artifact) {
        next.artifact = event.artifact;
      }
      return next;
    });
    if (isTerminalState(event.state)) {
      terminalRef.current = true;
    }
  }, []);

  const startFixtureFallback = useCallback(() => {
    setUsingFixture(true);
    setConnection('fixture');
    if (fixtureStepMs <= 0) {
      for (const event of DEMO_FIXTURE_EVENTS) applyEvent(event);
      return () => undefined;
    }
    let index = 0;
    const timer = setInterval(() => {
      const event = DEMO_FIXTURE_EVENTS[index];
      if (!event) {
        clearInterval(timer);
        return;
      }
      applyEvent(event);
      index += 1;
    }, fixtureStepMs);
    return () => clearInterval(timer);
  }, [applyEvent, fixtureStepMs]);

  useEffect(() => {
    terminalRef.current = false;
    openedRef.current = false;
    let cancelled = false;
    let stopFixture: (() => void) | undefined;
    /**
     * Held in an object so the handlers below can close the subscription that is only
     * assigned once `subscribe` returns. `closeRequested` covers the case where a
     * handler fires synchronously during that call.
     */
    const subscription: { close?: () => void; closed: boolean; closeRequested: boolean } = {
      closed: false,
      closeRequested: false,
    };

    /**
     * The API ends the event stream once a run reaches a terminal state. EventSource
     * would then reconnect on its own and replay the entire history forever, so the
     * subscription is torn down explicitly rather than left to auto-retry.
     */
    const closeStream = () => {
      if (subscription.closed) return;
      if (!subscription.close) {
        subscription.closeRequested = true;
        return;
      }
      subscription.closed = true;
      subscription.close();
    };

    setConnection((current) => (current === 'reconnecting' ? current : 'connecting'));

    subscription.close = transport.subscribe(runEventsUrl(runId), {
      onOpen: () => {
        if (cancelled) return;
        openedRef.current = true;
        attemptsRef.current = 0;
        setConnection('open');
      },
      onMessage: (data) => {
        if (cancelled) return;
        openedRef.current = true;
        setConnection('open');
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(data);
        } catch {
          return; // ignore malformed frames rather than breaking the stage screen
        }
        const parsed = SseEventSchema.safeParse(parsedJson);
        if (!parsed.success) return;
        applyEvent(parsed.data);
      },
      onError: () => {
        if (cancelled) return;
        if (terminalRef.current) {
          // The run finished and the server ended the response. Close for good so
          // EventSource does not reconnect and replay the whole history on a loop.
          setConnection('closed');
          closeStream();
          return;
        }
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS && !openedRef.current) {
          setConnection('offline');
          if (demoMode) {
            stopFixture = startFixtureFallback();
          }
          return;
        }
        setConnection('reconnecting');
      },
    });

    if (subscription.closeRequested) {
      subscription.closed = true;
      subscription.close();
    }

    return () => {
      cancelled = true;
      if (!subscription.closed) subscription.close?.();
      stopFixture?.();
    };
  }, [runId, transport, applyEvent, startFixtureFallback, demoMode, attempt]);

  const retry = useCallback(() => {
    attemptsRef.current = 0;
    setUsingFixture(false);
    setConnection('connecting');
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo<RunStreamValue>(
    () => ({ ...snapshot, runId, connection, usingFixture, eventCount, retry }),
    [snapshot, runId, connection, usingFixture, eventCount, retry],
  );

  return <RunStreamContext.Provider value={value}>{children}</RunStreamContext.Provider>;
}

export function useRunStream(): RunStreamValue {
  const value = useContext(RunStreamContext);
  if (!value) throw new Error('useRunStream must be used inside a RunStreamProvider');
  return value;
}

/** Respects the OS reduced-motion setting for entrance and progress animations. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (eventData: MediaQueryListEvent) => setReduced(eventData.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
