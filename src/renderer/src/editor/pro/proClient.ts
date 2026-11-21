// Клиент индекса символов Pro-режима: запросы в main (IPC pro:sym), готовность индекса, отправка несохранённых текстов.
import type { CursorReq, IndexStatus, SymDto } from '../../../../main/pro/symbols/types'

export type { CursorReq, SymDto }

let readyFor: string | null = null
let ensuring: Promise<IndexStatus | null> | null = null
let lastStatus: IndexStatus | null = null

type Listener = (s: IndexStatus | null) => void
const listeners = new Set<Listener>()
export const onIndexStatus = (cb: Listener): (() => void) => { listeners.add(cb); return () => listeners.delete(cb) }
export const indexStatus = (): IndexStatus | null => lastStatus

/** Запрос к службе индекса; null — ошибка или индекс недоступен. */
export async function sym<T>(kind: string, args: object = {}): Promise<T | null> {
  try {
    const r = await window.api.pro.sym<T>(kind, args as Record<string, unknown>)
    return r.ok ? r.data : null
  } catch {
    return null
  }
}

/** Собрать (или освежить) индекс открытого проекта. Параллельные вызовы объединяются. */
export function ensureIndex(configuration?: string, force = false): Promise<IndexStatus | null> {
  if (ensuring) return ensuring
  const p = sym<IndexStatus>('ensure', { configuration, force }).then((s) => {
    lastStatus = s
    readyFor = s?.ready ? s.root : null
    listeners.forEach((l) => l(s))
    return s
  })
  ensuring = p
  void p.finally(() => { ensuring = null })
  return p
}

export const indexReady = (): boolean => readyFor !== null

/** Запрос, который при необходимости дожидается индекса. */
export async function query<T>(kind: string, args: object = {}): Promise<T | null> {
  if (!indexReady()) { const s = await ensureIndex(); if (!s?.ready) return null }
  return sym<T>(kind, args)
}

export function resetIndexState(): void {
  readyFor = null
  lastStatus = null
  listeners.forEach((l) => l(null))
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Текст открытого файла (в том числе несохранённый) для индекса: с задержкой, чтобы не слать на каждую букву. */
export function pushOverlay(path: string, text: string, immediate = false): void {
  clearTimeout(timers.get(path))
  const send = (): void => { timers.delete(path); if (indexReady()) void sym('overlay', { path, text }) }
  if (immediate) send()
  else timers.set(path, setTimeout(send, 250))
}

/** Сбросить отложенную отправку (перед запросом, который должен видеть актуальный текст). */
export function flushOverlay(path: string, text: string): Promise<unknown> {
  clearTimeout(timers.get(path))
  timers.delete(path)
  return indexReady() ? sym('overlay', { path, text }) : Promise.resolve()
}
