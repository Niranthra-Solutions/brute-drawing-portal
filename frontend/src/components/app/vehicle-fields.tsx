import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useBootstrap, useCascade, type VehicleSel } from '@/lib/hooks'
import { FSelect } from './fields'

/**
 * Strict cascading selects Category > Make > Type > Model > Capacity bound to a react-hook-form `vehicle` object.
 * Reports the resolved master-data model id through `onResolved`.
 */
export function VehicleFields({ onResolved }: { onResolved?: (modelId: string | undefined) => void }) {
  const { data: b } = useBootstrap()
  const form = useFormContext<{ vehicle: VehicleSel }>()
  const sel = useWatch({ control: form.control, name: 'vehicle' })
  const c = useCascade(b, sel)
  useEffect(() => { onResolved?.(c.resolved?.id) }, [c.resolved?.id, onResolved])
  useEffect(() => { if (sel.modelName && c.capacities.length === 1 && sel.capacity !== c.capacities[0]) form.setValue('vehicle.capacity', c.capacities[0], { shouldValidate: true }) }, [c.capacities, sel.modelName, sel.capacity, form])
  const clear = (...f: (keyof VehicleSel)[]) => f.forEach(k => form.setValue(`vehicle.${k}`, ''))
  const control = form.control
  return (
    <>
      <FSelect control={control} name="vehicle.categoryId" label="Vehicle category" required placeholder="Select category" options={(b?.categories ?? []).map(x => ({ value: x.id, label: x.name }))} onValueChange={() => clear('makeId', 'typeId', 'modelName', 'capacity')} />
      <FSelect control={control} name="vehicle.makeId" label="Vehicle make" required placeholder="Select make" disabled={!sel.categoryId} options={c.makes.map(x => ({ value: x.id, label: x.name }))} onValueChange={() => clear('typeId', 'modelName', 'capacity')} />
      <FSelect control={control} name="vehicle.typeId" label="Vehicle type" required placeholder="Select type" disabled={!sel.makeId} options={c.types.map(x => ({ value: x.id, label: x.name }))} onValueChange={() => clear('modelName', 'capacity')} />
      <FSelect control={control} name="vehicle.modelName" label="Model no." required placeholder="Select model" disabled={!sel.typeId} options={c.modelNames.map(x => ({ value: x, label: x }))} onValueChange={() => clear('capacity')} />
      <FSelect control={control} name="vehicle.capacity" label="Vehicle capacity" required placeholder="Select capacity" disabled={!sel.modelName} options={c.capacities.map(x => ({ value: x, label: x }))} />
    </>
  )
}
