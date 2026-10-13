// In-memory addon_removals_owed (same rules as the table: one open row per subscription, merge on save).
import type { AddonId } from '../src/lib/plans/ladder'
import type { RemovalOwed, RemovalOwedClear, RemovalOwedStore } from '../src/lib/stripe/addon-removal-owed'

export type MemOwedRow = RemovalOwed & { clearedHow: RemovalOwedClear | null; clearedInvoiceId: string | null }

export function memRemovalOwedStore(opts: { failClearTimes?: number } = {}) {
  const rows: MemOwedRow[] = []
  let failClear = opts.failClearTimes ?? 0
  let n = 0
  const store: RemovalOwedStore = {
    async save(o) {
      const open = rows.find((r) => r.subscriptionId === o.subscriptionId && r.clearedHow === null)
      if (open) {
        open.addons = [...new Set<AddonId>([...open.addons, ...o.addons])]
        open.effectiveAt = o.effectiveAt
        return
      }
      rows.push({ ...o, id: `owed_${++n}`, clearedHow: null, clearedInvoiceId: null })
    },
    async open(subscriptionId) {
      return rows.filter((r) => r.subscriptionId === subscriptionId && r.clearedHow === null).map((r) => ({ id: r.id, subscriptionId: r.subscriptionId, customerId: r.customerId, userId: r.userId, addons: [...r.addons], effectiveAt: r.effectiveAt }))
    },
    async clear(id, how, invoiceId) {
      if (failClear > 0) {
        failClear--
        throw new Error('db down (simulated)')
      }
      const r = rows.find((x) => x.id === id)!
      r.clearedHow = how
      r.clearedInvoiceId = invoiceId
    },
    async keep(subscriptionId, addon) {
      for (const r of rows.filter((x) => x.subscriptionId === subscriptionId && x.clearedHow === null)) {
        r.addons = r.addons.filter((a) => a !== addon)
        if (r.addons.length === 0) r.clearedHow = 'kept'
      }
    },
  }
  return { store, rows }
}
