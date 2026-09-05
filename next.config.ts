import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Emits `.next/standalone`, a self-contained `server.js` with only the
  // traced dependencies beside it. This is what runs in the container, and
  // it is what makes the artifact portable: inside the image it is an
  // ordinary Node server on a port, not anything AWS-shaped.
  output: 'standalone',

  images: {
    // Google is the only sign-in, so its avatar host is the only remote image the
    // app ever loads. Narrow on purpose: anything else should not be renderable.
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
};

/**
 * Sentry wraps the config rather than sitting beside it, because what it adds
 * happens at build time: uploading source maps, and minting the tunnel route.
 *
 * **Source maps only upload when `SENTRY_AUTH_TOKEN` is set**, which it is not
 * on a laptop and should not be - it is a build secret, distinct from the DSN,
 * and it belongs in the deploy workflow. Without it the build succeeds and says
 * nothing, so an unreadable production stack trace is the symptom to look for.
 *
 * `webpack.treeshake` is deliberately absent: this project builds with
 * Turbopack, where those options do nothing.
 */
export default withSentryConfig(nextConfig, {
  org: 'khans-apps',
  project: 'learnr',

  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Client stack traces are the ones that matter here - the play screen and the
  // speed run are where a child is - and this uploads enough of the client
  // bundle to resolve them.
  widenClientFileUpload: true,

  /*
    Sentry's own ingest host is on every ad-blocker list there is, and a blocked
    request is an error that never gets reported. Routing it through this app's
    own origin costs a Vercel function invocation per event, which is the trade:
    the Hobby plan's invocations against actually hearing about a crash. Drop
    this line if the invocations start to matter.
  */
  tunnelRoute: '/monitoring',

  // Quiet locally, loud in CI, where a failed source map upload is worth seeing.
  silent: !process.env.CI,
});
