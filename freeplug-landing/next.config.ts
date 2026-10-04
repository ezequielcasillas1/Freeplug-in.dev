import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";
import {
  PREVIEW_HEADER_SOURCES,
  PREVIEW_RESPONSE_HEADERS,
  SITE_SECURITY_HEADER_SOURCE,
  SITE_SECURITY_HEADERS,
} from "./src/lib/outreach/headers";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      // One resized photo or screenshot per request (server cap 5 MB) plus form overhead.
      // Our own cap; Cloudflare's edge allows 100 MB (Free/Pro zone). See body-limit.ts.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    const toList = (h: Record<string, string>) => Object.entries(h).map(([key, value]) => ({ key, value }));
    return [
      // Security headers on every path (moved from netlify.toml in the Cloudflare port). Listed
      // first: when two rules set the same key, Next uses the later one, so the preview rules'
      // Referrer-Policy: no-referrer below wins on those paths.
      { source: SITE_SECURITY_HEADER_SOURCE, headers: toList(SITE_SECURITY_HEADERS) },
      // Private outreach preview / claim pages: noindex, no-store, no-referrer (Vera rule 5).
      ...PREVIEW_HEADER_SOURCES.map((source) => ({ source, headers: toList(PREVIEW_RESPONSE_HEADERS) })),
    ];
  },
};

// next-intl (Spanish build, Oct 4): request config in src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
