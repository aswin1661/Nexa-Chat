import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true // We'll handle ESLint separately
  },
  typescript: {
    // !! WARN !!
    // We're allowing production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true
  }
};

export default nextConfig;
