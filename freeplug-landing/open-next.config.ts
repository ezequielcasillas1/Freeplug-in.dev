import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Cloudflare port (Aria A1, Oct 3). The app has no ISR/revalidate, no unstable_cache and no
// 'use cache'; only 5 routes are prerendered (/, /faq, /robots.txt, /sitemap.xml, /icon.svg).
// The read-only static-assets cache serves those from the Worker's assets, so no R2, KV, D1 or
// Durable Objects are needed. https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
