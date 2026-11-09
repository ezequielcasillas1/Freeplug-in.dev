# Freeplug landing (freeplug-in.dev)

Landing site for Freeplug. Homepage: https://freeplug-landing.vercel.app

The app lives in `freeplug-landing/` (Next.js, deployed to Cloudflare via OpenNext; Supabase backend; Vitest tests). See `freeplug-landing/README.md` for details.

## Development
```bash
npm install --prefix freeplug-landing
npm run dev      # next dev
npm test         # vitest
npm run build
```
Root scripts proxy to `freeplug-landing/`. Additional notes: `HOSTING-LADDER-NOTES.md`, `CF-PORT-NOTES.md`, `SUPABASE-AUTH-CHECKLIST.md`.
