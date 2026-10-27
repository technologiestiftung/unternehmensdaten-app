import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs .next/standalone, not `next start`.
  output: "standalone",
};

export default nextConfig;
