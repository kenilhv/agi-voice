'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRunStream } from '@/lib/run-stream';

/**
 * The five demo acts. A step only becomes reachable once the backend has actually
 * produced the data behind it, so the UI can never present a stage that did not run.
 */
export function RunStepper({ runId }: { runId: string }) {
  const stream = useRunStream();
  const pathname = usePathname();

  const steps = [
    { href: `/run/${runId}`, label: 'Live run', ready: true },
    { href: `/run/${runId}/failure`, label: 'Failure', ready: stream.failures.length > 0 },
    {
      href: `/run/${runId}/explore`,
      label: 'Exploration',
      ready: stream.results.some((result) => result.scenarioId.includes('-near-')),
    },
    { href: `/run/${runId}/minimize`, label: 'Minimizer', ready: Boolean(stream.counterexample) },
    { href: `/run/${runId}/verify`, label: 'Verification', ready: Boolean(stream.artifact) },
  ];

  return (
    <nav className="vf-stepper" aria-label="Demo acts">
      {steps.map((step, index) => (
        <Link
          key={step.href}
          href={step.href}
          className="vf-step"
          data-ready={step.ready}
          aria-current={pathname === step.href ? 'page' : undefined}
          aria-disabled={step.ready ? undefined : true}
          tabIndex={step.ready ? undefined : -1}
        >
          <span className="vf-step__index">{index + 1}</span>
          {step.label}
        </Link>
      ))}
    </nav>
  );
}
