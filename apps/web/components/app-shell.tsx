'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DEMO_MODE } from '@/lib/config';
import { Badge } from './ui';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/connect', label: 'Connect agent' },
  { href: '/lab', label: 'Test lab' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="vf-shell">
      <nav className="vf-nav" aria-label="Primary">
        <Link href="/" className="vf-brand">
          Voice<b>Fuzz</b>
          <span>adaptive crash-test lab</span>
        </Link>
        <div className="vf-nav__links">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="vf-nav__link"
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="vf-nav__right">
          <span className="vf-reveal">The transcript passed. The voice failed.</span>
          {DEMO_MODE ? <Badge tone="warn">Demo mode</Badge> : null}
        </div>
      </nav>
      <main className="vf-main">{children}</main>
    </div>
  );
}
