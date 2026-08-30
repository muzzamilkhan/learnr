'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * The last thing standing between a React render error and a blank screen.
 * Next only reaches for this when the root layout itself failed, so it replaces
 * the whole document and cannot use anything from `layout.tsx` - which is why
 * it carries its own `<html>` and `<body>` and no shell, no fonts and no nav.
 *
 * It is written out rather than drawing `next/error`, because that component
 * renders the Pages Router's own styling and this app has never looked like
 * that. A child who has hit this cannot read a stack trace and should not be
 * shown one: they get a sentence and the way back to the front door, which is
 * the only action that can possibly help.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-AU">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#fdfcfa',
          color: '#2f2a26',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ margin: 0, fontSize: '1.125rem', maxWidth: '28rem' }}>
          That is our fault, not yours. Try again in a moment.
        </p>
        <a
          href="/"
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            padding: '0.75rem 1.5rem',
            borderRadius: '9999px',
            background: '#5b53c6',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          Go home
        </a>
      </body>
    </html>
  );
}
