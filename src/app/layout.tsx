import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Learnr',
  description: 'Practice maths at your own pace.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Stops the iPad zooming when a child double-taps an answer button.
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f7f9fc',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
