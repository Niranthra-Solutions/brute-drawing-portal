import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Bootstrap, ModelItem } from './types'

export function useBootstrap() {
  return useQuery({ queryKey: ['bootstrap'], queryFn: () => api.get<Bootstrap>('/api/lookups/bootstrap'), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true })  // cheap: server answers 304 via ETag when master data is unchanged
}
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export interface VehicleSel { categoryId: string; makeId: string; typeId: string; modelName: string; capacity: string }
export const emptyVehicle: VehicleSel = { categoryId: '', makeId: '', typeId: '', modelName: '', capacity: '' }

/** Client-side cascade: Category > Make > Type > Model > Capacity, computed from the cached bootstrap payload (no round trips). */
export function useCascade(b: Bootstrap | undefined, sel: VehicleSel) {
  return useMemo(() => {
    const models = b?.models ?? []
    const byCat = models.filter(m => !sel.categoryId || m.categoryId === sel.categoryId)
    const makeIds = new Set(byCat.map(m => m.makeId))
    const byMake = byCat.filter(m => !sel.makeId || m.makeId === sel.makeId)
    const typeIds = new Set(byMake.map(m => m.vehicleTypeId))
    const byType = byMake.filter(m => !sel.typeId || m.vehicleTypeId === sel.typeId)
    const modelNames = [...new Set(byType.map(m => m.name))].sort((a, c) => a.localeCompare(c, undefined, { numeric: true }))
    const byName = byType.filter(m => m.name === sel.modelName)
    const capacities = [...new Set(byName.map(m => m.capacity))]
    const resolved: ModelItem | undefined = sel.categoryId && sel.makeId && sel.typeId && sel.modelName && sel.capacity ? byName.find(m => m.capacity === sel.capacity) : undefined
    return { makes: (b?.makes ?? []).filter(x => makeIds.has(x.id)), types: (b?.vehicleTypes ?? []).filter(x => typeIds.has(x.id)), modelNames, capacities, resolved }
  }, [b, sel])
}
export function vehicleFromModel(b: Bootstrap | undefined, modelId: string | null | undefined): VehicleSel {
  const m = b?.models.find(x => x.id === modelId)
  return m ? { categoryId: m.categoryId, makeId: m.makeId, typeId: m.vehicleTypeId, modelName: m.name, capacity: m.capacity } : emptyVehicle
}