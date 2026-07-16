import { useMemo } from 'react'
import { useCatalogueProducts } from '../db/useTransactions'
import { isUncategorized, shouldBeTaxed } from '../engine/catalogueAuditEngine'

export function useFabsAuditCount(): number {
  const catalogue = useCatalogueProducts()
  return useMemo(() => {
    let n = 0
    for (const p of catalogue) {
      if (!p.enabled) continue
      if (isUncategorized(p)) { n++; continue }
      if (shouldBeTaxed(p) !== p.taxable) n++
    }
    return n
  }, [catalogue])
}
