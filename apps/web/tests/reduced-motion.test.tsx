import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useReducedMotion } from '@/lib/run-stream';
import { setReducedMotion } from '../vitest.setup';

function Probe() {
  const reduced = useReducedMotion();
  return <span data-testid="reduced">{String(reduced)}</span>;
}

describe('reduced motion', () => {
  it('reports the OS preference when motion should be reduced', () => {
    setReducedMotion(true);
    render(<Probe />);
    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
  });

  it('defaults to full motion when no preference is set', () => {
    setReducedMotion(false);
    render(<Probe />);
    expect(screen.getByTestId('reduced')).toHaveTextContent('false');
  });
});
