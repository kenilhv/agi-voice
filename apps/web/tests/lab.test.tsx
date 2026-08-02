import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { AgentProfile, TestRun, TestSuite } from '@voicefuzz/contracts';
import { ApiOfflineError } from '@/lib/api';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/lab',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const listSuites = vi.fn();
const createAgent = vi.fn();
const createRun = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    listSuites: (...args: unknown[]) => listSuites(...args),
    createAgent: (...args: unknown[]) => createAgent(...args),
    createRun: (...args: unknown[]) => createRun(...args),
  };
});

const { default: TestLabPage } = await import('@/app/lab/page');

const SUITES: TestSuite[] = [
  {
    id: 'endpoint-hunter',
    name: 'Endpoint Hunter',
    description: 'Varies silence and hesitation.',
    status: 'available',
    mutationAxes: [{ name: 'pause_ms', min: 250, max: 800, step: 50 }],
    scenarioIds: [],
  },
  {
    id: 'correction-mutator',
    name: 'Correction Mutator',
    description: 'Changes intent mid-utterance.',
    status: 'available',
    mutationAxes: [],
    scenarioIds: [],
  },
  {
    id: 'prosody-twin',
    name: 'Prosody Twin',
    description: 'Varies emotion while words stay constant.',
    status: 'planned',
    mutationAxes: [],
    scenarioIds: [],
  },
  {
    id: 'silence-walker',
    name: 'Silence Walker',
    description: 'Long thinking pauses.',
    status: 'planned',
    mutationAxes: [],
    scenarioIds: [],
  },
];

const AGENT: AgentProfile = {
  id: 'agent-1',
  name: 'IT Support Agent',
  targetVariant: 'vulnerable',
  silenceThresholdMs: 400,
  deviceId: 'demo-device-001',
  environmentId: 'it-support-reset',
  createdAt: '2026-08-01T00:00:00.000Z',
};

const RUN: TestRun = {
  id: 'run-1',
  agentId: 'agent-1',
  suiteIds: ['endpoint-hunter', 'correction-mutator'],
  seed: 42,
  state: 'queued',
  targetVariant: 'vulnerable',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  progress: { total: 0, completed: 0, message: 'queued' },
  failureIds: [],
  resultIds: [],
};

describe('Test Lab', () => {
  beforeEach(() => {
    push.mockReset();
    listSuites.mockReset();
    createAgent.mockReset();
    createRun.mockReset();
  });

  it('offers available suites and labels planned suites as coming soon', async () => {
    listSuites.mockResolvedValue(SUITES);
    render(<TestLabPage />);

    const available = await screen.findByRole('button', { name: /Endpoint Hunter/ });
    expect(available).toBeEnabled();

    const planned = screen.getByRole('button', { name: /Prosody Twin/ });
    expect(planned).toBeDisabled();
    expect(planned).toHaveTextContent('Coming soon');
  });

  it('never counts a planned suite toward the estimated case count', async () => {
    const user = userEvent.setup();
    listSuites.mockResolvedValue(SUITES);
    render(<TestLabPage />);

    await screen.findByRole('button', { name: /Endpoint Hunter/ });
    // Both available suites are selected by default: 2 x 5 cases.
    expect(screen.getByText('10 cases')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Correction Mutator/ }));
    expect(screen.getByText('5 cases')).toBeInTheDocument();

    // Clicking a planned suite must not change anything.
    await user.click(screen.getByRole('button', { name: /Silence Walker/ }));
    expect(screen.getByText('5 cases')).toBeInTheDocument();
  });

  it('starts a run against the real endpoints and navigates to the stage screen', async () => {
    const user = userEvent.setup();
    listSuites.mockResolvedValue(SUITES);
    createAgent.mockResolvedValue(AGENT);
    createRun.mockResolvedValue(RUN);

    render(<TestLabPage />);
    await screen.findByRole('button', { name: /Endpoint Hunter/ });

    await user.click(screen.getByRole('button', { name: 'Find the breaking point' }));

    await waitFor(() => expect(createRun).toHaveBeenCalledTimes(1));
    expect(createRun.mock.calls[0]![0]).toMatchObject({
      agentId: 'agent-1',
      seed: 42,
      suiteIds: ['endpoint-hunter', 'correction-mutator'],
      targetVariant: 'vulnerable',
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/run/run-1'));
  });

  it('surfaces an offline API instead of pretending a run started', async () => {
    listSuites.mockRejectedValue(new ApiOfflineError('Cannot reach VoiceFuzz API'));
    render(<TestLabPage />);

    expect(await screen.findByText('VoiceFuzz API unreachable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find the breaking point' })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('reports a failed run start as an error', async () => {
    const user = userEvent.setup();
    listSuites.mockResolvedValue(SUITES);
    createAgent.mockResolvedValue(AGENT);
    createRun.mockRejectedValue(new Error('AGENT_NOT_FOUND'));

    render(<TestLabPage />);
    await screen.findByRole('button', { name: /Endpoint Hunter/ });
    await user.click(screen.getByRole('button', { name: 'Find the breaking point' }));

    expect(await screen.findByText('Run could not start')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
