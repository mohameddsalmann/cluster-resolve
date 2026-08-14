import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { DatasetProvider } from '@/lib/context/dataset-context';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cluster Resolve',
  description:
    'Unofficial candidate prototype — reliability/observability layer for pharmaceutical AI procurement decisions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-white text-ink antialiased">
        <DatasetProvider>{children}</DatasetProvider>
      </body>
    </html>
  );
}
