import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google is the only sign-in, so its avatar host is the only remote image the
    // app ever loads. Narrow on purpose: anything else should not be renderable.
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
};

export default nextConfig;
