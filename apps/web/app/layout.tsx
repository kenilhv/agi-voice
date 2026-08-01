import type { ReactNode } from 'react';

export const metadata = {
  title: 'VoiceFuzz',
  description: 'Minimal API connectivity shell for VoiceFuzz',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
