import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // One service-role path (Aria, section 6): only these files may import the admin client.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/outreach/server.ts",
      "src/lib/rate-limit/**",
      "src/app/admin/**",
      "src/lib/admin/**",
      "src/app/(auth)/actions.ts",
      "src/app/(dashboard)/dashboard/buyout-actions.ts",
      "src/app/(dashboard)/dashboard/request-website/actions.ts",
      "src/app/api/webhooks/stripe/route.ts",
      "src/lib/stripe/checkout-customer.ts",
      "src/lib/stripe/sync-checkout-customer.ts",
      "src/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Service-role client: use src/lib/outreach/server.ts (or another allowlisted server module) instead.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/supabase/admin", "**/supabase/admin"],
              message:
                "Service-role client: use src/lib/outreach/server.ts (or another allowlisted server module) instead.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local pre-change backup copies (not part of the app).
    ".owen-backup-*/**",
  ]),
]);

export default eslintConfig;
