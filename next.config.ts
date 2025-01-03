import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverComponentsHmrCache: true, // defaults to true
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
