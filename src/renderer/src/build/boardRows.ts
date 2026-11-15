// Список плат для выбора: установленные (из arduino-cli) и популярные без установленного ядра.
import { useMemo } from 'react'
import { BOARD_PRESETS } from './boards'
import { useBuild } from './useBuild'

export interface BoardRow { name: string; fqbn: string; installed: boolean }

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
      // Если список ядер известен и ядро стоит — платы из него уже пришли из arduino-cli
      if (found && installedCores.has(p.core)) continue
      rows.push({ name: p.name, fqbn: p.fqbn, installed: false })
    }
    return rows
  }, [boards, cores, found])
}

/** Название платы по FQBN: из установленных ядер или из популярных; null — неизвестна. */
export function findBoardName(fqbn: string): string | null {
  const b = useBuild.getState().boards.find((x) => x.fqbn === fqbn) ?? BOARD_PRESETS.find((x) => x.fqbn === fqbn)
  return b?.name ?? null
}
