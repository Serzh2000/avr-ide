// Параметры платы (способ загрузки, USB, частота…): загрузка из `arduino-cli board details` и работа с FQBN.
import { useEffect } from 'react'
import { create } from 'zustand'
import type { BoardDetails } from '../../../main/cli/types'
import { baseFqbn, fqbnOptions } from '../../../main/cli/fqbn'
import { useBuild } from './useBuild'

export type DetailsState =
  | { state: 'loading' }
  | { state: 'ok'; data: BoardDetails }
  | { state: 'error'; error: string }

interface OptionsStore {
  /** По базовому FQBN (без параметров) */
  byBoard: Record<string, DetailsState>
  load: (fqbn: string, force?: boolean) => Promise<void>
}

const inflight = new Set<string>()

export const useBoardOptions = create<OptionsStore>((set, get) => ({
  byBoard: {},
  load: async (fqbn, force) => {
    const base = baseFqbn(fqbn)
    const cur = get().byBoard[base]
    if (inflight.has(base) || (!force && cur && cur.state !== 'error')) return
    inflight.add(base)
    set((s) => ({ byBoard: { ...s.byBoard, [base]: { state: 'loading' } } }))
    const r = await window.api.cli.boardDetails(base)
    inflight.delete(base)
    set((s) => ({ byBoard: { ...s.byBoard, [base]: r.ok ? { state: 'ok', data: r.data } : { state: 'error', error: r.error } } }))
  }
}))

/** Значения по умолчанию (отмечены selected при запросе без параметров): id → value. */
export function defaultsOf(d: BoardDetails | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const o of d?.options ?? []) {
    const v = o.values.find((x) => x.selected) ?? o.values[0]
    if (v) out[o.id] = v.value
  }
  return out
}

/** Действующие значения: умолчания платы, поверх них — то, что записано в FQBN. */
export function effectiveOptions(fqbn: string, d: BoardDetails | undefined): Record<string, string> {
  return { ...defaultsOf(d), ...fqbnOptions(fqbn) }
}

/** Подпись значения параметра (value_label) по id параметра и значению. */
export function valueLabel(d: BoardDetails | undefined, optionId: string, value: string): string {
  return d?.options.find((o) => o.id === optionId)?.values.find((v) => v.value === value)?.label ?? value
}

/** Параметры, которые пользователь изменил (есть в FQBN), в виде «Способ загрузки: ST-Link». */
export function explicitSummary(fqbn: string, d: BoardDetails | undefined): { id: string; label: string; value: string }[] {
  return Object.entries(fqbnOptions(fqbn)).map(([id, value]) => ({
    id,
    label: d?.options.find((o) => o.id === id)?.label ?? id,
    value: valueLabel(d, id, value)
  }))
}

/** Подгружает параметры платы для базового FQBN, когда плата установлена. */
export function useBoardDetails(fqbn: string, enabled = true): DetailsState | undefined {
  const base = baseFqbn(fqbn)
  const st = useBoardOptions((s) => s.byBoard[base])
  const cores = useBuild((s) => s.cores)
  const found = useBuild((s) => s.status?.found)
  const core = base.split(':').slice(0, 2).join(':')
  const installed = !!cores?.some((c) => c.id === core && c.installed)
  const coreSig = cores === null ? 'n' : installed ? 'y' : 'x'
  useEffect(() => {
    if (!enabled || !found || !fqbn || !installed) return
    void useBoardOptions.getState().load(base)
  }, [enabled, found, fqbn, base, installed, coreSig])
  // После установки или обновления ядра список параметров мог измениться
  useEffect(() => {
    if (installed && useBoardOptions.getState().byBoard[base]?.state === 'error') void useBoardOptions.getState().load(base, true)
  }, [installed, base])
  return st
}
