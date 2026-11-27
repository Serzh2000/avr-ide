// Хранилище библиотек проекта: по #include из текстов скетча (debounce) запрашивает у main разобранные заголовки.
// Без window.api.libs (браузер/заглушка) молча остаётся пустым.
import { useEffect, useSyncExternalStore } from 'react'
import type { ProjectLibrary } from '../contracts'
import { buildIndex, EMPTY_INDEX, type LibIndex } from './model'

export interface LibsState {
  libs: ProjectLibrary[]
  index: LibIndex
  /** Растёт при каждом обновлении. */
  version: number
  loading: boolean
  error?: string
}

type Channel = 'editor' | 'reference'

const DEBOUNCE_MS = 600
let state: LibsState = { libs: [], index: EMPTY_INDEX, version: 0, loading: false }
const listeners = new Set<() => void>()
const channels: Record<Channel, string[]> = { editor: [], reference: [] }
let fqbn: string | null = null
let sketchDir: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastKey = ''
let seq = 0
let focusBound = false

function emit(next: Partial<LibsState>): void {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

/** Имена #include из текстов (без комментариев), по порядку первого появления. */
export function includesOf(texts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const text of texts) {
    if (!text) continue
    const src = text.length > 2_000_000 ? text.slice(0, 2_000_000) : text
    const clean = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '')
    const re = /^[ \t]*#[ \t]*include[ \t]*([<"])([^>"\n]+)[>"]/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(clean))) {
      const line = `#include ${m[1] === '<' ? '<' + m[2].trim() + '>' : '"' + m[2].trim() + '"'}`
      if (!seen.has(line)) {
        seen.add(line)
        out.push(line)
      }
      if (out.length >= 400) return out
    }
  }
  return out
}

type LibsApi = { forSketch: (code: string, options?: { sketchDir?: string | null; fqbn?: string | null }) => Promise<{ ok: true; data: ProjectLibrary[] } | { ok: false; error: string }> }

function api(): LibsApi | null {
  try {
    const a = (globalThis as unknown as { window?: { api?: { libs?: LibsApi } } }).window?.api?.libs
    return a && typeof a.forSketch === 'function' ? a : null
  } catch {
    return null
  }
}

async function load(force: boolean): Promise<void> {
  const lines = includesOf([...channels.editor, ...channels.reference])
  const key = lines.join('\n') + '|' + (fqbn ?? '')
  if (!force && key === lastKey) return
  const a = api()
  if (!a) return
  lastKey = key
  const my = ++seq
  if (lines.length === 0) {
    emit({ libs: [], index: EMPTY_INDEX, version: state.version + 1, loading: false, error: undefined })
    return
  }
  emit({ loading: true })
  try {
    const res = await a.forSketch(lines.join('\n'), { fqbn, sketchDir })
    if (my !== seq) return // пришёл более новый запрос
    if (res.ok) emit({ libs: res.data, index: buildIndex(res.data), version: state.version + 1, loading: false, error: undefined })
    else emit({ loading: false, error: res.error })
  } catch (e) {
    if (my === seq) emit({ loading: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function schedule(immediate = false): void {
  if (timer) clearTimeout(timer)
  timer = undefined
  if (immediate) void load(false)
  else timer = setTimeout(() => void load(false), DEBOUNCE_MS)
}

function bindFocus(): void {
  if (focusBound || typeof window === 'undefined') return
  focusBound = true
  // после установки библиотеки (другой агент/окно) — перечитать при возврате в окно
  window.addEventListener('focus', () => void refreshLibs())
}

/** Задать тексты скетча источника (editor — текущий файл + файлы скетча, reference — переданный справочнику код). */
export function setSketchSources(channel: Channel, texts: string[], opts?: { fqbn?: string | null; sketchDir?: string | null }): void {
  bindFocus()
  const before = channels[channel]
  const changed = before.length !== texts.length || before.some((t, i) => t !== texts[i])
  channels[channel] = texts
  let optsChanged = false
  if (opts) {
    if (opts.fqbn !== undefined && (opts.fqbn || null) !== fqbn) {
      fqbn = opts.fqbn || null
      optsChanged = true
    }
    if (opts.sketchDir !== undefined) sketchDir = opts.sketchDir || null
  }
  if (!changed && !optsChanged) return
  // первый запрос — без задержки, дальше debounce
  schedule(state.version === 0 && !state.loading && lastKey === '')
}

/** Принудительно перечитать (после установки библиотеки). */
export function refreshLibs(): Promise<void> {
  return load(true)
}

export function getLibsState(): LibsState {
  return state
}

export function getLibIndex(): LibIndex {
  return state.index
}

export function subscribeLibs(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** React-хук: состояние библиотек. sketchCode — необязательный текст скетча для источника «справочник». */
export function useProjectLibs(sketchCode?: string): LibsState {
  useEffect(() => {
    if (sketchCode !== undefined) setSketchSources('reference', [sketchCode])
  }, [sketchCode])
  return useSyncExternalStore(subscribeLibs, getLibsState)
}

/** Только для тестов. */
export function _resetLibsStoreForTests(): void {
  state = { libs: [], index: EMPTY_INDEX, version: 0, loading: false }
  channels.editor = []
  channels.reference = []
  lastKey = ''
  fqbn = null
  seq = 0
  if (timer) clearTimeout(timer)
}

/** Плата и папка скетча, с которыми справочник запрашивает библиотеки. */
export function libsQueryOptions(): { fqbn: string | null; sketchDir: string | null } {
  return { fqbn: fqbn ?? null, sketchDir: sketchDir ?? null }
}
