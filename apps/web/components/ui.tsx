import type { ReactNode } from 'react';

export type Tone = 'muted' | 'info' | 'active' | 'warn' | 'fail' | 'pass' | 'fixture';

export function Badge({
  tone = 'muted',
  children,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`vf-badge vf-badge--${tone}`}>
      {dot ? <span className="vf-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Shown wherever cached or fixture content stands in for a live backend response. */
export function DemoFixtureBadge({ reason }: { reason?: string }) {
  return (
    <span className="vf-badge vf-badge--fixture" title={reason ?? 'Cached demo fixture content'}>
      Demo fixture
    </span>
  );
}

export function Panel({
  title,
  caption,
  actions,
  children,
  flush = false,
}: {
  title?: ReactNode;
  caption?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={`vf-panel${flush ? ' vf-panel--flush' : ''}`}>
      {title || actions ? (
        <header className="vf-panel__head">
          <div className="vf-panel__title">
            <h2 className="vf-h3">{title}</h2>
            {caption ? <p className="vf-eyebrow">{caption}</p> : null}
          </div>
          {actions ? <div className="vf-row">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'fail' | 'pass';
}) {
  return (
    <div className="vf-kpi">
      <span className="vf-kpi__label">{label}</span>
      <span className={`vf-kpi__value${tone ? ` vf-kpi__value--${tone}` : ''}`}>{value}</span>
      {note ? <span className="vf-kpi__note">{note}</span> : null}
    </div>
  );
}

export function Callout({
  children,
  variant = 'default',
  title,
}: {
  children: ReactNode;
  variant?: 'default' | 'error' | 'info';
  title?: string;
}) {
  const className =
    variant === 'error'
      ? 'vf-callout vf-callout--error'
      : variant === 'info'
        ? 'vf-callout vf-callout--info'
        : 'vf-callout';
  return (
    <div className={className} role={variant === 'error' ? 'alert' : undefined}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="vf-empty">
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
      {action}
    </div>
  );
}

export function LoadingLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="vf-col" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="vf-skeleton" style={{ width: `${100 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function ProgressBar({ total, completed }: { total: number; completed: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return (
    <div
      className="vf-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="vf-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
