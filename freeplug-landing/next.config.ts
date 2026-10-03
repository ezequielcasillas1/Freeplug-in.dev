import type { NextConfig } from "next";
import path from "path";
import { PREVIEW_HEADER_SOURCES, PREVIEW_RESPONSE_HEADERS } from "./src/lib/outreach/headers";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      // One resized photo or screenshot per request (server cap 5 MB) plus form overhead.
      // Netlify's request body limit is about 6 MB.
      bodySizeLimit: "6mb",
    },
  },
  // Private outreach preview / claim pages: noindex, no-store, no-referrer (Vera rule 5).
  async headers() {
    return PREVIEW_HEADER_SOURCES.map((source) => ({
      source,
      headers: Object.entries(PREVIEW_RESPONSE_HEADERS).map(([key, value]) => ({ key, value })),
    }));
  },
};

export default nextConfig;
