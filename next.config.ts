import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev-tools badge overlaps the pipeline graph's zoom controls,
  // which sit in the same corner. Dev-only UI, nothing lost by hiding it.
  devIndicators: false,

  // /query folded into the ledger (§5). Redirect rather than 404 so any
  // bookmark from before the merge still lands somewhere sensible.
  async redirects() {
    return [{ source: "/query", destination: "/ledger", permanent: true }];
  },
};

export default nextConfig;
