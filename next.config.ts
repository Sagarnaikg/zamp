import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev-tools badge overlaps the pipeline graph's zoom controls,
  // which sit in the same corner. Dev-only UI, nothing lost by hiding it.
  devIndicators: false,
};

export default nextConfig;
