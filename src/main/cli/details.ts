// Разбор вывода `arduino-cli board details --format json` (без Electron — тестируется напрямую).
import { baseFqbn, isOptionKey, isOptionValue } from './fqbn'
import type { BoardDetails } from './types'

type Obj = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Разбор `board details`: только безопасные идентификаторы (по ним потом строится FQBN). */
export function parseBoardDetails(d: Obj, fqbn: string): BoardDetails {
  const raw: Obj[] = Array.isArray(d.config_options) ? d.config_options : []
  const options = raw
    .map((o) => ({
      id: String(o.option ?? ''),
      label: String(o.option_label ?? o.option ?? ''),
      values: ((Array.isArray(o.values) ? o.values : []) as Obj[])
        .map((v) => ({ value: String(v.value ?? ''), label: String(v.value_label ?? v.value ?? ''), selected: !!v.selected }))
        .filter((v) => isOptionValue(v.value))
    }))
    .filter((o) => isOptionKey(o.id) && o.values.length > 0)
  return { fqbn: baseFqbn(fqbn), name: String(d.name ?? baseFqbn(fqbn)), options }
}
