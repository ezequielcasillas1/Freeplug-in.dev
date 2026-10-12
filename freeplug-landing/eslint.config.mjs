import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const NODEMAILER_MSG =
  "nodemailer was removed (Resend primary, Oct 3): send through sendMail() in src/lib/email/mailer.ts. To go back, apply resend-primary.patch in reverse.";

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
      "src/lib/email/webhook-email-ledger.ts",
      "src/lib/plans/plan-change-lock-server.ts",
      // L-1 (Oct 4): addon_removals_owed store (service_role-only table, RLS), same pattern as the lock store.
      "src/lib/stripe/addon-removal-owed-server.ts",
      "src/lib/stripe/checkout-customer.ts",
      // Envato picker (Oct 12): catalog store adapter, service_role-only tables.
      "src/lib/envato/store-server.ts",
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
  // Cloudflare port (Oct 3): sharp can't load on Workers. App code uses the Images binding
  // (src/lib/outreach/image-codec-cloudflare.ts); sharp is a devDependency for tests only
  // (test/image-codec-sharp.ts). A separate rule name so it doesn't replace the block above.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "sharp", message: "sharp can't run on Cloudflare Workers: use processUploadedImage() (Images binding)." },
            { name: "nodemailer", message: NODEMAILER_MSG },
          ],
          patterns: [{ group: ["nodemailer/*", "@types/nodemailer"], message: NODEMAILER_MSG }],
        },
      ],
    },
  },
  // Resend primary (Oct 3): nodemailer was removed. Tests, test helpers, scripts and root config files too
  // (src app code is covered by the block above; core rule name, so neither block replaces the other).
  {
    files: ["src/**/*.test.{ts,tsx}", "test/**/*.{ts,tsx,js,mjs}", "scripts/**/*.{ts,mts,js,mjs,cjs}", "*.{ts,mts,js,mjs,cjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "nodemailer", message: NODEMAILER_MSG }],
          patterns: [{ group: ["nodemailer/*", "@types/nodemailer"], message: NODEMAILER_MSG }],
        },
      ],
    },
  },
  // CommonJS require and dynamic import of nodemailer, in any file.
  {
    files: ["**/*.{ts,tsx,mts,js,mjs,cjs}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "ImportExpression[source.value=/^nodemailer(\\/|$)/]", message: NODEMAILER_MSG },
        { selector: "CallExpression[callee.name='require'][arguments.0.value=/^nodemailer(\\/|$)/]", message: NODEMAILER_MSG },
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
    // OpenNext / Wrangler build output (Cloudflare port).
    ".open-next/**",
    ".wrangler/**",
    // Local pre-change backup copies (not part of the app).
    ".owen-backup-*/**",
  ]),
]);

export default eslintConfig;
