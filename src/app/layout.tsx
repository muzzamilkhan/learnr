import type { Metadata, Viewport } from 'next';
import './globals.css';

const description =
  'Maths practice for Kindergarten to Year 6, written against the Australian Curriculum. ' +
  'Questions are generated rather than stored, and what comes next is chosen from what a ' +
  'child is finding hard. No timer, no score - and a weekly report for parents.';

export const metadata: Metadata = {
  // The tab icon, the iOS home-screen icon and the link preview are the files
  // beside this one - `icon.png`, `apple-icon.png`, `favicon.ico` and
  // `opengraph-image.png`, all cut from `public/logo.PNG`. Next wires them up
  // by name, so the only thing needed here is a base for their absolute URLs;
  // without it a preview would be advertised at a relative path nothing can
  // fetch. On Vercel that base is the deployment; locally it is the dev server.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000'),
  ),
  title: 'LearnR',
  description,
  // The child's screens are full-screen and installable to the home screen, so
  // iOS is told to drop its own chrome when it opens from there.
  appleWebApp: { capable: true, title: 'LearnR', statusBarStyle: 'default' },
  openGraph: { title: 'LearnR', description, type: 'website' },
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
