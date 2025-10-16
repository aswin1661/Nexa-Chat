import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  // Use standalone output for custom server
  ...(process.env.NODE_ENV === 'production' && process.env.NOW_REGION 
    ? { 
        // Vercel environment
        webpackCachePath: ".next/cache",
      }
    : {
        // Local environment
        output: "standalone",
      }
  ),
  poweredByHeader: false,
};

export default nextConfig;
