import json,datetime
rows=json.load(open('/workspace/freeplug-grants.json'));checks=json.load(open('/workspace/freeplug-link-checks.json')); cmap={r['name']:r for r in checks}
def dt(d):return '<date start="'+d+'" />'
s='''## Goal and guardrails
Keep Freeplug (freeplug-in.dev) moving through steady productivity, development planning, research and self-study. By February 8, 2027, understand the business and technical systems, verify the legal setup and have a grant-ready evidence pack.

Internal planning only. No merge, deploy, purchase, application, registration or outbound message is authorized by this plan. Future actions need Cheke’s separate approval. Grant awards are competitive, not a promised success measure. “Loopholes” means legal and business rules—not evading them.

## Three phases
- Month 1, Nov 9–Dec 8: setup and foundations. Baseline progress, verify entity status, prepare documents, study security, clarify grants and pricing.
- Month 2, Dec 9–Jan 7: build and study. Draft/test system designs locally only after separate approval; complete legal readiness and a grant application pack.
- Month 3, Jan 8–Feb 8: settle and prepare. Review gaps, document operating procedures and make the next-quarter plan.

## Weekly focus blocks
Tuesdays and Thursdays, 6–8 PM America/Chicago (CT), Nov 10–Feb 4. Tuesday: Freeplug progress/design; Thursday: study and grant readiness. Suggested split: 60% Freeplug, 25% grants, 15% study. Holiday blocks are optional; no existing events are changed.

| Week beginning | Focus and concrete output |
| --- | --- |
| Nov 9 | Baseline: customer/revenue numbers, open work, risks; confirm 72After LLC status and lawyer questions. |
| Nov 16 | Auth, payments and privacy threat checklist; grant eligibility shortlist and document inventory. |
| Nov 23 | Contracts, Envato licenses, Texas entity and tax questions; draft grant story and budget. |
| Nov 30 | Complete two Verizon qualifying courses if Cheke chooses; final readiness check before Dec 7. |
| Dec 7 | Month 1 review; pricing/tier decision table and test scenarios. |
| Dec 14 | Verify LLC, DBA, EIN and bank account; define edit queue and 5-business-day clock rules. |
| Dec 21 | Draft intake grading pipeline, fairness checks and failure handling; holiday catch-up. |
| Dec 28 | NASE readiness if membership is already eligible; caching/search design and invalidation rules. |
| Jan 4 | Month 2 review; measure finished work and unresolved risks. |
| Jan 11 | Check Verizon result if an application was separately submitted; business rules and SEO policies review. |
| Jan 18 | Security review, payments/auth/privacy evidence; rehearse intake-to-delivery process on paper. |
| Jan 25 | Close documentation gaps; grant tracker and next-cycle watchlist. |
| Feb 1 | Final readiness evidence pack and next-quarter priorities. |
| Feb 8 | Final progress review and three-month success milestone. |

## Legal setup — if not already done
Memory dated Nov 1 says the intended structure is 72After LLC, a Texas LLC, with Freeplug as its DBA. Formation, EIN and bank account were not verified. Do not assume they exist, or create a duplicate entity.
- Nov 12: inspect existing formation/DBA/EIN/bank evidence privately; record only done/not done, never identifiers or secrets.
- Nov 24: prepare lawyer questions: ownership/operating agreement, contracts, minimum term, auto-renewal, refunds, domain ownership, buyout, Envato licensing and tax/1099 duties.
- Dec 1 preferred: legal identity and tax-document readiness for grants. An LLC is not a universal grant prerequisite; use the true current business identity, and ask the funder about updates after a structure change.
- Dec 15 target: 72After LLC formed and in good standing, Freeplug assumed name filed as required, EIN obtained and business bank account in place, if not already done. Filing, fees and bank signup require separate approval.
- Feb 8 hard review: verify records and compliance calendar with the lawyer/accountant; no false declaration of completion.

## Dated milestones and evidence
| Date | Milestone | Evidence |
| --- | --- | --- |
| Nov 12 | Entity status and grant-fit check | Done/not-done legal checklist; eligible/maybe/not-fit grant shortlist |
| Nov 19 | Security foundations | Site/app threat model; auth, payment/webhook and privacy checklist; OWASP reading |
| Nov 24 | Legal/business ins and outs | Texas LLC/DBA, contracts, Envato licensing, tax/1099s and Google Business Profile questions |
| Dec 3 | Grant application preparation push | Verizon course completion check; story, use-of-funds budget and evidence pack; no submission |
| Dec 7 | Verizon qualifying-activity cutoff | Published 2026 two-course/event deadline; application timing rechecked before any later action |
| Dec 8 | Month 1 assessment | Compare baseline, work completed, study notes, risks and next month priorities |
| Dec 10 | Algorithms: pricing/tier logic | Decision table, tier IDs/backward compatibility and boundary-case tests |
| Dec 15 | LLC + DBA + EIN + bank ready, if not done | Verify legal records privately; filing actions not authorized here |
| Dec 17 | Algorithms: edit queue and clocks | Queue/state model, priority rules, business-day/holiday clock and refund scenarios |
| Dec 22 | Algorithms: intake grading pipeline | Schema, stages, transparent scoring rubric, retries and review gates |
| Dec 29 | Algorithms: caching and search | Data structures, indexes, cache keys/TTL, invalidation and search relevance test plan |
| Jan 5 | Grant pack review / application push | Recheck live eligibility/deadlines; prepare drafts only; NASE Oct–Dec review occurs in January |
| Jan 7 | Month 2 assessment | Document readiness and technical design progress; pick final gaps |
| Jan 12 | Verizon final decision check | Only if separately applied; provider says all final decisions by this date |
| Jan 14 | Legal/business and local SEO review | Resolve counsel questions; Google profile/service-area rules; contract/license checklist |
| Jan 21 | Security readiness review | Auth permissions, webhook verification/idempotency, privacy/data retention and incident checklist |
| Feb 4 | Final readiness rehearsal | Walk intake → grading → pricing → edit queue → QA; identify owner and next action per gap |
| Feb 8 | Final assessment and success milestone | Legal setup verified if needed; grant tracker current; security/business/system notes usable; next quarter ready |

## Grants — full previously discussed inventory
Source: Freeplug Lead, positions 987–991, 1164–1170 and 1200–1208; its linked [Grants for Freeplug research page](https://cursor.com/canvas/store-e18c8913-7fc9-4372-aa30-af250a9da5c7/c697e39c-8a70-492c-bc7b-0d6cc1a85447) contains all 34 programs below. Jarvis transcript lookup returned no accessible history for the supplied ID. These are 34 funding-related programs, not 34 grants Freeplug qualifies for. Historical amounts/terms remain labeled; confirm live terms before acting.

Prioritize Verizon ($10,000, two free activities), then consider NASE (up to $4,000, paid membership). BOOST is coaching with a conditional stipend, not guaranteed cash. A home-based San Marcos business generally does not fit neighboring-city storefront grants. Do not move, take a loan or buy membership just to chase an award. Do not reimburse the same expense twice.

| Provider | Type | Amount/Eligibility | Sign-up link | Status | Notes |
| --- | --- | --- | --- | --- | --- |
'''
for r in rows:
 c=cmap[r['name']]; code=str(c['code']);note=r['status']+'; '+r['area']+'. '+r['limits']+' Link check Nov 8: '+code+'.'
 if r['name']=='Buda Downtown Co-Marketing Grant':note+=' Current overview now loads: up to $1,000 / 100% reimbursement; older $3,000 claim conflicts. Historic Downtown Buda only.'
 if r['name']=='Seguin Fix-It Facade Grant':note+=' URL now returned HTTP 200, but deadline/terms not freshly confirmed; Dec 1, 5 PM CT was historical index-only evidence. Not scheduled as a verified deadline.'
 if c.get('final') and c['final']!=r['url']:note+=' Redirects to '+c['final']+'; redirect does not establish an open application.'
 vals=[r['name'],r['level'],r['amount']+'; '+r['eligible'],'[Provider / application route]('+r['url']+')','Not started',note]
 s+='| '+' | '.join(x.replace('|','\\|').replace('\n',' ') for x in vals)+' |\n'
s+='''
### Other previously discussed support and discovery links
Not separate cash grants. Source: same Freeplug Lead research page.
'''
for n in ['Texas State SBDC','Hello Alice','SBA grants','Hays Caldwell EDP']:
 c=cmap[n];s+=f"- [{n}]({c['url']}) — link check: {c['code']}. Advising/discovery only; no signup performed.\n"
s+='''
### Grant dates and next actions
- Nov 12: screen legal/business location/ownership eligibility and collect current documents.
- Dec 3: prepare Verizon draft and course evidence; do not wait for a new LLC if the existing lawful business already qualifies.
- Dec 7: verified cutoff for the two qualifying Verizon 2026 activities. The public page says apply once in 2026, but does not give a distinct exact final submission time; recheck the unlocked form before any submission.
- Jan 5: recheck grant rounds and finalize drafts; NASE applications from Oct–Dec are reviewed in January, subject to eligible paid membership.
- Jan 12: Verizon final decision date if separately applied. Amazon’s next round is unannounced; do not assume May 2027 dates.
- No grant application, appointment, membership or signup was submitted. All table statuses are Not started; Notes describe program availability, not application progress.

## Self-Study Materials
### Recommended study posts
These five resources are free to read; links checked Nov 8, 2026, all HTTP 200. If “job posts” meant actual job listings to study skill requirements, we can swap those in.
'''
recs=[('OWASP Top 10','Nov 19 and Jan 21: site/app security, auth, payments and privacy threat review.'),('Texas LLC basics','Nov 24 and Jan 14: entity/DBA questions; discuss application to your facts with counsel.'),('Open Data Structures','Dec 10–29: choose queues, maps, trees and indexes for pricing, edit clocks, intake, caching and search.'),('Google SEO Starter Guide','Jan 14: local-business site search foundations; pair with Google Business Profile policy help below.'),('Stripe SaaS pricing','Dec 10: tier value, pricing-model tradeoffs and unit economics; provider-authored, not independent advice.')]
for n,t in recs:s+=f"- [{n}]({cmap[n]['url']}) — {t}\n"
s+='''
### Self-study links we discussed before
Source: Freeplug Lead position 1097 (full self-study curriculum); sequencing at positions 1194–1197. Jarvis’s supplied transcript ID returned no accessible history. Book/publisher links are references, not claims that the books are free; nothing purchased.
'''
for c in checks[43:]:
 s+=f"- [{c['name']}]({c['url']}) — link check {c['code']}"
 if c['name']=='CAN-SPAM':s+='; redirected to a federal access-check page, so content not verified'
 if c['name']=='Josh Hall Podcast':s+='; HTTP 202, content not confirmed'
 s+='; Freeplug Lead position 1097.\n'
s+='''
Suggested sequence: Nov 10–24: $100M Offers, subscription web design guide, The Mom Test, website leasing and Fanatical Prospecting. December: pricing books/guides, HubSpot sales/CRM and repeatable-service material. January: local SEO, Google profile and sender policies. For legal questions, bring CAN-SPAM and contract clauses to counsel; reading is not legal advice.

### My own study materials (from Cheke)
- [ ] Add Cheke’s links, books, courses and notes here.

## Calendar dates
Primary calendar: ezequielcasillas1@gmail.com. All timed items use America/Chicago (CT). Private solo holds; no guests or invitations. Existing Freeplug-event search found no matches. Free/busy returned no blocking intervals; existing all-day/free reminders are left alone.
- Weekly focus series: every Tuesday and Thursday 6–8 PM CT, Nov 10, 2026–Feb 4, 2027 (26 occurrences).
'''
events=[('2026-11-12','Freeplug entity status and grant fit'),('2026-11-19','Freeplug security foundations'),('2026-11-24','Freeplug legal and business study'),('2026-12-03','Freeplug grant application preparation'),('2026-12-07','Freeplug Verizon qualifying-activity cutoff'),('2026-12-08','Freeplug Month 1 assessment'),('2026-12-10','Freeplug pricing and tier algorithms'),('2026-12-15','Freeplug LLC DBA EIN and bank milestone'),('2026-12-17','Freeplug edit queue and business-day clocks'),('2026-12-22','Freeplug intake grading pipeline'),('2026-12-29','Freeplug caching and search'),('2027-01-05','Freeplug grant draft review'),('2027-01-07','Freeplug Month 2 assessment'),('2027-01-12','Freeplug Verizon decision check'),('2027-01-14','Freeplug legal and local SEO review'),('2027-01-21','Freeplug security readiness review'),('2027-02-04','Freeplug final readiness rehearsal'),('2027-02-08','Freeplug final progress assessment'),('2027-02-08','Freeplug 3-Month Success Milestone')]
all_day={4,7,13,18};review={5,12,17}
for i,(d,n) in enumerate(events):
 t='all-day (reminder, not a booking)' if i in all_day else ('5–6 PM CT' if i in review else '5–5:45 PM CT')
 s+=f'- {dt(d)}: {n} — {t}.\n'
json.dump(events,open('/workspace/freeplug-planned-events.json','w'));open('/workspace/freeplug-plan.md','w').write(s)
print('content chars',len(s))
