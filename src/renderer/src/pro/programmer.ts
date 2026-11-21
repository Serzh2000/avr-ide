// Тип программатора проекта (ST-Link, J-Link, CMSIS-DAP): связь проекта с состоянием прошивки и смена типа (запись в avride.project.json).
import type { Probe } from '../../../main/pro/interfaces'
import { normalizeProgrammerKind, programmerLabel } from '../../../shared/pro/programmers'
import type { ProgrammerKind } from '../../../shared/pro/programmers'
import { useUi } from '../shell/ui'
import { useHw } from './hwStore'
import { useProStore } from './proStore'

export const probesOfKind = (probes: Probe[], kind: ProgrammerKind): Probe[] => probes.filter((p) => p.kind === kind)

let wired = false
/** Подписка: тип программатора и частота ядра проекта попадают в состояние прошивки; при смене типа список устройств перечитывается. */
export function initProgrammer(): void {
  if (wired) return
  wired = true
  const sync = (): void => {
    const p = useProStore.getState().project
    const kind = normalizeProgrammerKind(p?.programmer.kind)
    const sysclkHz = p?.target.clock?.sysclkHz ?? 0
    const cur = useHw.getState()
    if (cur.kind === kind && cur.sysclkHz === sysclkHz) return
    const changed = cur.kind !== kind
    useHw.setState({ kind, sysclkHz })
    // ошибка прошлой прошивки относилась к другому программатору: убираем, чтобы карточка не вводила в заблуждение
    if (changed && useHw.getState().flash.status === 'error') useHw.setState({ flash: { status: 'idle', label: '', fraction: 0 } })
    if (changed) void useHw.getState().refreshProbes()
  }
  useProStore.subscribe(sync)
  sync()
}

/** Меняет тип программатора в avride.project.json. Устройство не трогает. */
export async function setProgrammerKind(kind: ProgrammerKind): Promise<void> {
  const st = useProStore.getState()
  if (!st.project || st.project.programmer.kind === kind) return
  if (useHw.getState().swo.status !== 'off' || useHw.getState().debug.status !== 'off' || useHw.getState().flash.status === 'running') {
    useUi.getState().notify('Сначала остановите отладку, SWO или прошивку: тип программатора менять нельзя, пока он занят.', { kind: 'error' })
    return
  }
  const r = await window.api.pro.saveProject({ ...st.project, programmer: { ...st.project.programmer, kind } })
  if (!r.ok) { useUi.getState().notify(r.error, { kind: 'error' }); return }
  await st.reloadProject()
  initProgrammer()
  await useHw.getState().refreshProbes()
}

/** Подпись для шапки: имя найденного программатора проекта или «<тип>: не найден». */
export function headerProbe(probes: Probe[], loaded: boolean, kind: ProgrammerKind): { text: string; missing: boolean } {
  const mine = probesOfKind(probes, kind)
  if (mine.length) return { text: mine[0].name, missing: false }
  return { text: loaded ? `${programmerLabel(kind)}: не найден` : programmerLabel(kind), missing: loaded }
}
