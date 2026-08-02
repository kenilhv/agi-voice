import type { ReactNode } from 'react';
import './globals.css';
import { AppShell } from '@/components/app-shell';

export const metadata = {
  title: 'VoiceFuzz — the adaptive crash-test lab for voice agents',
  description:
    'Find the one sentence—and the exact timing—that breaks your voice agent. VoiceFuzz explores, minimizes and permanently captures voice-agent failures.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
