# Freeplug service catalog and priority list (Aria). Docs only; nothing live changes without Cheke's OK.
Added Oct 22, 2026, 7:30 PM CT (Cheke, via Jacqueline). Production is still on hold.

| # | Offering | Build route (technical direction) | What we will NOT custom-build |
|---|---|---|---|
| 1 | Small and local business websites (existing) | An Envato HTML or WordPress template, quote form, NAP | Custom themes |
| 2 | Landing pages for creators | An Envato landing-page template; email signup (Resend), link-in-bio, social embeds | Membership or paywall systems |
| 3 | Booking sites for freelancers | An Envato template plus an embedded scheduler (Cal.com, or Calendly if the client already has it), with Stripe deposit optional | A custom calendar or booking engine |
| 4 | Simple one-product e-commerce | An Envato landing or shop template plus a Stripe Payment Link or Checkout; shipping and tax through Stripe | Carts, inventory, multi-product stores (those mean WooCommerce or Shopify, out of scope) |
| 5 | Small or mini SaaS apps (simple only) | Next.js on Cloudflare Workers plus Supabase auth and DB plus Stripe, the same stack as Freeplug. Scoped by architecture card first. | Anything beyond about 3 core screens, one user role and one payment flow; no AI pipelines, marketplaces, mobile apps or integrations beyond Stripe and Resend |

## Priority (suggested)
1 (existing), then 2 and 4 (template-only, fastest), then 3, then 5.

## Flags for Cheke
- Mini SaaS is custom code, unlike the template-only rule for sites. It needs a size cap like the one above, its own pricing (the page-tier buyout doesn't fit apps), and a rule on who hosts and pays for Supabase and Cloudflare.
- Owen/Bob builds it, and Lina designs from Envato UI kits.
- For e-commerce, the client is the merchant of record, on their own Stripe account; Freeplug doesn't take payments for their sales. Decide whether it's Stripe Connect or the client's own account.
- Picker and outreach template matching need new business types for creator, freelancer booking, single-product shop and SaaS. That's Lina's tagging, plus a picker change later.

## Request workflow: consultation layer (Cheke, Oct 22, 2026, 7:53 PM CT). Design only, not built.
Flow: request sent, then reviewed, then **consultation**, then client clicks "Looks good" (agreed), then building. Nothing is built or charged (domain included) before "agreed".
The client picks one of two paths:
1. **Detailed request form**: the comprehensive answers are the consultation. It covers site type and page count (which sets the buyout tier), the template, content and photos, the domain path, forms, booking or payments, the plan, and the timeline.
2. **Live session**: skip the detailed fields and book time with the team by phone, FaceTime, webcam or text. The team fills in the same checklist from the session, and the client confirms it.
Either path ends at the same checklist plus the "Looks good" gate.
Build notes for later:
- Add a `consult_path` field (form or live) and a `consultation` status.
- Calls and texts need logged consent per the standing rule.
- Booking uses an embedded scheduler, not a custom one.
- About 1–1.5 days once the hold lifts.
