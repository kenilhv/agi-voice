'use client';

import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConnectionStatus } from '@/components/connection-status';
import { RunStepper } from '@/components/run-stepper';
import { RunStreamProvider } from '@/lib/run-stream';

/**
 * One SSE subscription for the whole run, held in the layout so that moving between
 * demo acts never drops or restarts the stream.
 */
export default function RunLayout({ children }: { children: ReactNode }) {
  const { runId } = useParams<{ runId: string }>();

  return (
    <RunStreamProvider runId={runId}>
      <ConnectionStatus />
      <RunStepper runId={runId} />
      {children}
    </RunStreamProvider>
  );
}
