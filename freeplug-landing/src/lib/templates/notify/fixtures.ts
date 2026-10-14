import type { ItemDetails, RequestContext } from './notify'

/** Fixture data for tests and the outbox samples (not real customers). */
export const REQ_ID = '11111111-2222-4333-8444-555555555555'

export function item(p: Partial<ItemDetails> & { id: number; name: string }): ItemDetails {
  return {
    author: 'demoauthor', platform: 'wp', url: `https://themeforest.net/item/x/${p.id}`, previewImageUrl: `https://s3.envato.com/preview/${p.id}.jpg`,
    tags: [], autoNiches: [], rating: 4.5, sales: 800, publishedAt: '2025-06-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    onElements: true, status: 'active', priceCents: 5900, ...p,
  }
}

export function request(p: Partial<RequestContext> = {}): RequestContext & { version: number } {
  return {
    id: REQ_ID, businessName: 'Rivera Plumbing', businessType: 'plumbing_electrical', choice: 'envato_catalog', envatoItemId: 101,
    pastedUrl: null, firstPickedAt: '2026-10-14T15:00:00Z', unlockedUntil: null, pickedAt: '2026-10-14T15:00:00Z',
    notes: 'Emergency plumber, water heater repair, drain cleaning', version: 0, ...p,
  }
}

export const ITEMS: ItemDetails[] = [
  item({ id: 101, name: 'Plumbex - Plumber & Water Heater Repair WordPress Theme', tags: ['plumber', 'repair', 'heater'], autoNiches: ['plumbing_electrical'], sales: 2400 }),
  item({ id: 102, name: 'Pipeline Plumbing Services HTML Template', platform: 'html', tags: ['plumbing'], autoNiches: ['plumbing_electrical'], rating: 4.0, sales: 300, updatedAt: '2023-01-01T00:00:00Z' }),
  item({ id: 103, name: 'Sparky Electrician Theme', tags: ['electrician'], autoNiches: ['plumbing_electrical'], onElements: false, sales: 9000 }),
  item({ id: 201, name: 'LocalPro - Small Business Theme', tags: ['business', 'local'], autoNiches: [], sales: 5000 }),
  item({ id: 202, name: 'Handy - Multipurpose Services Theme', tags: ['repair', 'drain'], autoNiches: ['other_local'], sales: 1200 }),
  item({ id: 301, name: 'Dentalia Dental Clinic', tags: ['dentist'], autoNiches: ['dental', 'medical_clinic'] }),
]
