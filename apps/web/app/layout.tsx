import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cluster Control Tower',
  description:
    'Unofficial candidate prototype — reliability/observability layer for pharmaceutical AI procurement decisions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-base text-text-primary antialiased">
        {children}
        <footer className="fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-surface-base/95 px-4 py-2 text-center text-xs text-text-muted backdrop-blur">
          Unofficial candidate prototype. Not affiliated with, endorsed by, or connected to
          Cluster&apos;s production systems.
        </footer>
      </body>
    </html>
  );
}
