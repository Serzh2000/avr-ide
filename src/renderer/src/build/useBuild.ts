import { useCallback, useEffect, useRef, useState } from 'react'
import type { CliResult, CliStatus, DoneEvent } from '../../../main/cli/types'

const MAX_LOG = 300_000

export interface BuildState {
  status: CliStatus | null
  log: string
  busy: boolean
  /** Последнее завершённое событие — панели используют его для обновления списков */
  lastDone: DoneEvent | null
  append: (text: string) => void
  clear: () => void
  /** Запускает операцию; ошибку запуска (валидация, нет бинарника) печатает в лог */
  run: (p: Promise<CliResult<{ opId: number }>>) => Promise<boolean>
  cancel: () => void
  recheck: () => void
}

export function useBuild(): BuildState {
  const [status, setStatus] = useState<CliStatus | null>(null)
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastDone, setLastDone] = useState<DoneEvent | null>(null)
  const opRef = useRef<number | null>(null)

  const append = useCallback((text: string) => {
    setLog((l) => {
      const n = l + text
      return n.length > MAX_LOG ? n.slice(n.length - MAX_LOG) : n
    })
  }, [])

  const recheck = useCallback(() => {
    window.api.cli.status().then(setStatus)
  }, [])

  useEffect(() => {
    recheck()
    const offLog = window.api.cli.onLog((e) => append(e.text))
    const offDone = window.api.cli.onDone((e) => {
      opRef.current = null
      setBusy(false)
      setLastDone(e)
      append(
        e.cancelled
          ? '\n--- Отменено ---\n'
          : e.code === 0
            ? '\n--- Готово (код 0) ---\n'
            : `\n--- Ошибка: код завершения ${e.code} ---\n`
      )
    })
    return () => { offLog(); offDone() }
  }, [append, recheck])

  const run = useCallback(
    async (p: Promise<CliResult<{ opId: number }>>): Promise<boolean> => {
      setBusy(true)
      const r = await p
      if (!r.ok) {
        setBusy(false)
        append(`error: ${r.error}\n`)
        if (r.notFound) recheck()
        return false
      }
      opRef.current = r.data.opId
      return true
    },
    [append, recheck]
  )

  return {
    status, log, busy, lastDone, append, run, recheck,
    clear: () => setLog(''),
    cancel: () => { void window.api.cli.cancel() }
  }
}
