// Список плат для выбора: установленные (из arduino-cli) и популярные без установленного ядра.
import { useMemo } from 'react'
import { baseFqbn, fqbnOptions } from '../../../main/cli/fqbn'
import { BOARD_PRESETS } from './boards'
import { useBuild } from './useBuild'

export interface BoardRow { name: string; fqbn: string; installed: boolean }

const hasOptions = (fqbn: string): boolean => Object.keys(fqbnOptions(fqbn)).length > 0

export function useBoardRows(): BoardRow[] {
  const boards = useBuild((s) => s.boards)
  const cores = useBuild((s) => s.cores)
  const found = useBuild((s) => s.status?.found)
  return useMemo(() => {
    const rows: BoardRow[] = boards.map((b) => ({ name: b.name, fqbn: b.fqbn, installed: true }))
    const have = new Set(rows.map((r) => r.fqbn))
    const installedCores = new Set((cores ?? []).map((c) => c.id))
    for (const p of BOARD_PRESETS) {
      if (have.has(p.fqbn)) continue
      // Вариант с параметрами (Blue Pill = GenF1 + pnum) arduino-cli сам не перечисляет: показываем его, если ядро стоит
      if (hasOptions(p.fqbn)) {
        rows.push({ name: p.name, fqbn: p.fqbn, installed: !!found && installedCores.has(p.core) })
        continue
      }
      // Если список ядер известен и ядро стоит — платы из него уже пришли из arduino-cli
      if (found && installedCores.has(p.core)) continue
      rows.push({ name: p.name, fqbn: p.fqbn, installed: false })
    }
    return rows
  }, [boards, cores, found])
}

/** Строка списка, соответствующая текущему FQBN: точное совпадение (готовый вариант) или плата без параметров. */
export function matchRow<T extends { fqbn: string }>(rows: T[], fqbn: string): T | undefined {
  return rows.find((r) => r.fqbn === fqbn) ?? rows.find((r) => !hasOptions(r.fqbn) && r.fqbn === baseFqbn(fqbn))
}

/** Название платы по FQBN: из установленных ядер или из популярных; null — неизвестна. Параметры не учитываются, если готового варианта нет. */
export function findBoardName(fqbn: string, exactOnly = false): string | null {
  const st = useBuild.getState().boards
  const exact = st.find((x) => x.fqbn === fqbn) ?? BOARD_PRESETS.find((x) => x.fqbn === fqbn)
  if (exact || exactOnly) return exact?.name ?? null
  const b = matchRow(st, fqbn) ?? BOARD_PRESETS.find((x) => x.fqbn === baseFqbn(fqbn))
  return b?.name ?? null
}
