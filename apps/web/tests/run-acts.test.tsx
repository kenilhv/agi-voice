import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Failure } from '@voicefuzz/contracts';
import { DEMO_FIXTURE_EVENTS } from '@/lib/fixtures';
import { createFakeTransport, flush, renderInRunStream, TEST_RUN_ID } from './test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => `/run/${TEST_RUN_ID}`,
  useParams: () => ({ runId: TEST_RUN_ID }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const streamedFailure: Failure = DEMO_FIXTURE_EVENTS.find((event) => event.failure)!.failure!;

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, getFailure: async () => streamedFailure };
});

const { default: LiveRunPage } = await import('@/app/run/[runId]/page');
const { default: FailureDetailPage } = await import('@/app/run/[runId]/failure/page');
const { default: ExplorationPage } = await import('@/app/run/[runId]/explore/page');
const { default: MinimizerPage } = await import('@/app/run/[runId]/minimize/page');
const { default: VerificationPage } = await import('@/app/run/[runId]/verify/page');

/** Renders a run act with the full fixture stream already delivered. */
async function renderAct(ui: ReactNode) {
  const fake = createFakeTransport();
  const view = renderInRunStream(ui, { transport: fake.transport });
  await flush();
  fake.open();
  for (const event of DEMO_FIXTURE_EVENTS) fake.emit(event);
  await flush();
  return view;
}

/** Renders an act with an open but silent stream, to assert empty states. */
async function renderEmptyAct(ui: ReactNode) {
  const fake = createFakeTransport();
  const view = renderInRunStream(ui, { transport: fake.transport });
  await flush();
  fake.open();
  await flush();
  return view;
}

describe('Live run act', () => {
  it('lights the pipeline and raises an unmissable failure verdict', async () => {
    await renderAct(<LiveRunPage />);

    expect(await screen.findByText('Premature destructive action')).toBeInTheDocument();
    expect(screen.getByTestId('stage-tool')).toHaveAttribute('data-status', 'failed');
    expect(screen.getByRole('alert')).toHaveTextContent('Invariant broken');
  });

  it('shows the tool ledger reaching a committed state', async () => {
    await renderAct(<LiveRunPage />);

    const ledger = await screen.findByTestId('ledger-prepare_factory_reset');
    expect(ledger).toHaveTextContent('committed');
  });
});

describe('Failure detail act', () => {
  it('states the verdict with expected versus observed tool state', async () => {
    await renderAct(<FailureDetailPage />);

    expect(await screen.findByText('Expected')).toBeInTheDocument();
    expect(screen.getByText(/must not remain committed/)).toBeInTheDocument();
    expect(screen.getByText('Observed')).toBeInTheDocument();
    expect(screen.getByText(/remains committed after intent=cancel_reset/)).toBeInTheDocument();
  });

  it('classifies the layer and justifies it from timeline evidence, not a made-up score', async () => {
    await renderAct(<FailureDetailPage />);

    expect(await screen.findByText('TOOL_COMMIT_FAILURE')).toBeInTheDocument();
    expect(screen.getByText(/VAD committed end-of-turn at/)).toBeInTheDocument();
  });

  it('offers the exploration action', async () => {
    await renderAct(<FailureDetailPage />);
    expect(await screen.findByRole('link', { name: 'Explore nearby cases' })).toHaveAttribute(
      'href',
      `/run/${TEST_RUN_ID}/explore`,
    );
  });

  it('shows an empty state rather than a fabricated failure', async () => {
    await renderEmptyAct(<FailureDetailPage />);
    expect(await screen.findByText('No failure recorded on this run yet')).toBeInTheDocument();
  });
});

describe('Adaptive exploration act', () => {
  it('reports the observed boundary bracket from real cases', async () => {
    await renderAct(<ExplorationPage />);

    expect(await screen.findByText(/generated nearby tests/)).toBeInTheDocument();
    // 375 ms passed, 400 ms failed, so the boundary sits between them.
    expect(screen.getAllByText('375 ms').length).toBeGreaterThan(0);
    expect(screen.getAllByText('400 ms').length).toBeGreaterThan(0);
    expect(screen.getByText(/Boundary between 375 and 400 ms/)).toBeInTheDocument();
    expect(screen.getByText(/Behaviour flips between/)).toBeInTheDocument();
  });

  it('shows an empty state before any adaptive case exists', async () => {
    await renderEmptyAct(<ExplorationPage />);
    expect(await screen.findByText('No adaptive cases yet')).toBeInTheDocument();
  });
});

describe('Minimizer act', () => {
  it('renders the reductions and the minimum scenario shape', async () => {
    await renderAct(<MinimizerPage />);

    expect(await screen.findByText(/Reduced pause_ms to 450/)).toBeInTheDocument();
    expect(screen.getByText(/“Start the reset” \+ 450 ms \+ “Wait, no”/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export regression fixture' })).toBeInTheDocument();
  });

  it('shows an empty state when nothing has been minimized', async () => {
    await renderEmptyAct(<MinimizerPage />);
    expect(await screen.findByText('Nothing minimized yet')).toBeInTheDocument();
  });
});

describe('Fix verification act', () => {
  it('compares the vulnerable and guarded lanes on the same artifact', async () => {
    await renderAct(<VerificationPage />);

    const failLane = await screen.findByTestId('lane-fail');
    const passLane = screen.getByTestId('lane-pass');
    expect(failLane).toHaveTextContent('Vulnerable v1');
    expect(failLane).toHaveTextContent('FAIL');
    expect(passLane).toHaveTextContent('Guarded v2');
    expect(passLane).toHaveTextContent('PASS');
    expect(
      screen.getByText('One production failure became one permanent test.'),
    ).toBeInTheDocument();
  });

  it('exposes the exported regression artifact downloads', async () => {
    await renderAct(<VerificationPage />);

    const yaml = await screen.findByRole('link', { name: 'scenario.yaml' });
    expect(yaml).toHaveAttribute(
      'href',
      expect.stringContaining('/api/artifacts/VF-RESET-0042?download=scenario.yaml'),
    );
  });

  it('does not claim verification before the replays arrive', async () => {
    await renderEmptyAct(<VerificationPage />);
    expect(await screen.findByText('No replay lanes yet')).toBeInTheDocument();
  });
});
