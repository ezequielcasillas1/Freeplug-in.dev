'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  catalogFilterToSearchParams,
  mergeCatalogFilterState,
  parseCatalogFilterSearchParams,
} from '@/lib/merch/catalog-filter-logic'
import type { CatalogFilterState } from '@/lib/merch/catalog-filter-types'
import { EMPTY_CATALOG_FILTER } from '@/lib/merch/catalog-filter-types'

export function useCatalogFilterUrl(scope: 'all-merch' | 'shop') {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const state = useMemo(
    () => parseCatalogFilterSearchParams(new URLSearchParams(searchParams.toString()), scope),
    [searchParams, scope]
  )

  const setState = useCallback(
    (next: CatalogFilterState | ((prev: CatalogFilterState) => CatalogFilterState)) => {
      const resolved = typeof next === 'function' ? next(state) : next
      const q = catalogFilterToSearchParams(resolved, scope)
      const qs = q.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, scope, state]
  )

  const patchState = useCallback(
    (patch: Partial<CatalogFilterState>) => {
      setState(mergeCatalogFilterState(state, patch))
    },
    [setState, state]
  )

  const clearAll = useCallback(() => {
    setState({ ...EMPTY_CATALOG_FILTER })
  }, [setState])

  return { state, setState, patchState, clearAll }
}
