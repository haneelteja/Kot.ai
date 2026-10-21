import type { Metadata } from 'next';
import { GlobalErrorInit } from '@/components/GlobalErrorInit';
import { ErrorBoundary }   from '@/components/ErrorBoundary';
import { display, sans, mono } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'KOT.ai',
  description: 'Orders, straight to the kitchen.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <GlobalErrorInit />
        <ErrorBoundary name="RootLayout">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
