// Связь «страница конструктора ↔ скетч»: что лежит на диске, подключена ли страница к скетчу, актуален ли сгенерированный код.
// Здесь же — тихое обновление *_generated.h перед сборкой и переход к проблеме в конструкторе.
import { create } from 'zustand'
import { platformOf, isEspPlatform } from '../build/boards'
import { parseSketch } from '../uibuilder/sketch/parse'
import { PAGE_SPECS } from '../uibuilder/sketch/integrate'
import type { PageKind } from '../uibuilder/sketch/integrate'
import { serializeProject as serializeWeb } from '../webdesign/core/index'
import { useUiBuilder } from '../uibuilder/store'
import { useWebDesigner } from '../webdesign/store'
import { countPageItems, genPage, ledcApiFromJson, serializeUiPage } from './pageGen'
import { writeSketchFileSynced } from './host'
import { useProject } from './project'
import { useUi } from './ui'

export interface KindInfo {
  /** Текст файла страницы (ui.json / web_design.json) на диске или null. */
  json: string | null
  /** Текст сгенерированного заголовка на диске или null. */
  header: string | null
  /** Заголовок подключён директивой #include в главном файле скетча. */
  connected: boolean
  /** Страницу правили в этой сессии в этом проекте. */
  touched: boolean
  /** Элементов на странице (по сохранённому файлу или по живой модели). */
  items: number
}

const blank = (): KindInfo => ({ json: null, header: null, connected: false, touched: false, items: 0 })

interface LinkState {
  root: string | null
  ui: KindInfo
  web: KindInfo
  /** Запрос конструктору: открыть окно «Вставить в скетч» (nonce меняется при каждом запросе). */
  insertRequest: { kind: PageKind; nonce: number } | null
  patch: (kind: PageKind, p: Partial<KindInfo>) => void
}

export const usePageLink = create<LinkState>((set) => ({
  root: null,
  ui: blank(),
  web: blank(),
  insertRequest: null,
  patch: (kind, p) => set((s) => ({ [kind]: { ...s[kind], ...p } }) as Partial<LinkState>)
}))

const KINDS: PageKind[] = ['ui', 'web']

const pathIn = (root: string, name: string): string => root + (root.includes('\\') ? '\\' : '/') + name

async function readIn(root: string, name: string): Promise<string | null> {
  const r = await window.api.fs.read(pathIn(root, name))
  return r.ok ? r.data.content : null
}

function mainCode(): string | null {
  const p = useProject.getState()
  return p.mainFile ? p.docs[p.mainFile]?.content ?? null : null
}

export function isConnected(kind: PageKind, code: string | null): boolean {
  if (code === null) return false
  return parseSketch(code).includes.some((i) => i.header === PAGE_SPECS[kind].header)
}

/** Пересчитать «подключено» по тексту главного файла (быстро, без диска). */
function recomputeConnected(): void {
  const code = mainCode()
  const st = usePageLink.getState()
  for (const k of KINDS) {
    const c = isConnected(k, code)
    if (st[k].connected !== c) st.patch(k, { connected: c })
  }
}

let diskSeq = 0
/** Перечитать файлы страницы и заголовки из папки проекта. */
export async function reloadPageFiles(): Promise<void> {
  const root = useProject.getState().root
  const seq = ++diskSeq
  if (!root) {
    usePageLink.setState({ root: null, ui: blank(), web: blank() })
    return
  }
  const got: Record<PageKind, { json: string | null; header: string | null }> = { ui: { json: null, header: null }, web: { json: null, header: null } }
  for (const k of KINDS) {
    got[k] = { json: await readIn(root, PAGE_SPECS[k].json), header: await readIn(root, PAGE_SPECS[k].header) }
  }
  if (seq !== diskSeq || useProject.getState().root !== root) return
  const st = usePageLink.getState()
  for (const k of KINDS) {
    const g = got[k]
    const items = g.json !== null ? countPageItems(k, g.json) : st[k].touched ? st[k].items : 0
    st.patch(k, { json: g.json, header: g.header, items })
  }
  recomputeConnected()
}

// ---------- переход по смене проекта: подхватить сохранённые страницы ----------

let adopting = false
let adoptedFor: string | null = null

const ser = {
  ui: (): string => serializeUiPage(useUiBuilder.getState().project, useUiBuilder.getState().ledcApi),
  web: (): string => serializeWeb(useWebDesigner.getState().project)
}

/** Страница, сохранённая в папке проекта, становится текущей в конструкторе (один раз при открытии проекта). */
async function adoptSavedPages(): Promise<void> {
  const root = useProject.getState().root
  if (!root || adoptedFor === root) return
  adoptedFor = root
  const st = usePageLink.getState()
  adopting = true
  try {
    for (const k of KINDS) {
      const json = st[k].json
      if (json === null || json === ser[k]()) continue
      if (k === 'ui') {
        useUiBuilder.getState().importJson(json)
        const l = ledcApiFromJson(json)
        if (l) useUiBuilder.getState().setLedcApi(l)
      }
      else useWebDesigner.getState().importJson(json)
    }
  } finally {
    adopting = false
  }
}

useProject.subscribe((s, prev) => {
  if (s.root !== prev.root) {
    adoptedFor = null
    usePageLink.setState({ root: s.root, ui: blank(), web: blank() })
    void reloadPageFiles().then(adoptSavedPages)
    return
  }
  if (s.tree !== prev.tree) void reloadPageFiles()
  const a = s.mainFile ? s.docs[s.mainFile]?.content : undefined
  const b = prev.mainFile ? prev.docs[prev.mainFile]?.content : undefined
  if (a !== b) scheduleConnected()
})
let connTimer: ReturnType<typeof setTimeout> | undefined
function scheduleConnected(): void {
  clearTimeout(connTimer)
  connTimer = setTimeout(recomputeConnected, 250)
}

// ---------- автосохранение страницы в папку проекта (пока она подключена к скетчу) ----------

const saveTimers: Partial<Record<PageKind, ReturnType<typeof setTimeout>>> = {}

function onModelChange(kind: PageKind, items: number): void {
  if (adopting) return
  const st = usePageLink.getState()
  st.patch(kind, { touched: true, items })
  const info = st[kind]
  if (!info.connected || !useUi.getState().settings.autoRegenPage || !useProject.getState().root) return
  clearTimeout(saveTimers[kind])
  saveTimers[kind] = setTimeout(() => {
    const text = ser[kind]()
    if (text === usePageLink.getState()[kind].json) return
    void writeSketchFileSynced(PAGE_SPECS[kind].json, text).then((p) => {
      if (p) usePageLink.getState().patch(kind, { json: text })
    })
  }, 500)
}

useUiBuilder.subscribe((s, prev) => {
  if (s.project !== prev.project || s.ledcApi !== prev.ledcApi) onModelChange('ui', s.project.tabs.reduce((n, t) => n + t.elements.length, 0))
})
useWebDesigner.subscribe((s, prev) => {
  if (s.project !== prev.project) {
    let n = 0
    const go = (bs: typeof s.project.blocks): void => {
      for (const b of bs) {
        n++
        go(b.children)
      }
    }
    go(s.project.blocks)
    onModelChange('web', n)
  }
})

// ---------- действия ----------

/** Открыть конструктор и подсветить проблему (элемент/блок и вкладка «Проблемы»). */
export function openPageProblem(kind: PageKind, targetId?: string): void {
  useProject.getState().openPanel(kind)
  if (kind === 'ui') {
    const s = useUiBuilder.getState()
    if (targetId) s.reveal(targetId)
    s.setBottom('issues')
    s.setBottomOpen(true)
  } else {
    const s = useWebDesigner.getState()
    if (targetId) s.select(targetId)
    useWebDesigner.setState({ drawerOpen: true, bottom: 'issues' })
  }
}

/** «Подключить»: открыть конструктор и окно «Вставить в скетч». */
export function requestConnect(kind: PageKind): void {
  useProject.getState().openPanel(kind)
  usePageLink.setState({ insertRequest: { kind, nonce: Date.now() } })
}

/** Записать файл страницы (json) и заголовок. Возвращает путь заголовка или null. */
export async function writePageFiles(kind: PageKind, json: string, header: string): Promise<string | null> {
  const spec = PAGE_SPECS[kind]
  const p = await writeSketchFileSynced(spec.header, header)
  if (!p) return null
  await writeSketchFileSynced(spec.json, json)
  usePageLink.getState().patch(kind, { json, header })
  return p
}

/**
 * Перед «Проверить»/«Загрузить»: если страница подключена к скетчу, а заголовок на диске устарел — тихо перегенерировать его
 * из сохранённой страницы. Ошибки в модели не глотаются: понятное сообщение с кнопкой «Открыть конструктор».
 * Сборку не прерывает.
 */
export async function syncPagesBeforeBuild(fqbn: string): Promise<void> {
  const root = useProject.getState().root
  const code = mainCode()
  if (!root || code === null || !useUi.getState().settings.autoRegenPage) return
  const board = platformOf(fqbn)
  if (!isEspPlatform(board)) return
  const notify = useUi.getState().notify
  const updated: string[] = []
  for (const kind of KINDS) {
    if (!isConnected(kind, code)) continue
    const spec = PAGE_SPECS[kind]
    const json = await readIn(root, spec.json)
    if (json === null) continue
    const header = await readIn(root, spec.header)
    const gen = genPage(kind, { json, sketchCode: code, board, existingHeader: header })
    if (!gen.ok) {
      notify(`Файл ${spec.json} не разобрать (${gen.error}) — код страницы не обновлён, в прошивку пойдёт прошлая версия.`, {
        kind: 'error',
        action: { label: 'Открыть конструктор', run: () => openPageProblem(kind) }
      })
      continue
    }
    if (gen.errors.length) {
      const first = gen.errors[0]
      const more = gen.errors.length > 1 ? ` (и ещё ${gen.errors.length - 1})` : ''
      const tail =
        header !== null
          ? `Код ${spec.header} не обновлён — в прошивку пойдёт прошлая версия страницы.`
          : `Файл ${spec.header} записан с директивой #error — сборка остановится на ней, пока ошибки не исправлены.`
      if (header === null) await writePageFiles(kind, json, gen.header)
      notify(`Страница (${spec.title}) содержит ошибки: ${first.message}${more}. ${tail}`, {
        kind: 'error',
        action: { label: 'Открыть конструктор', run: () => openPageProblem(kind, first.targetId) }
      })
      continue
    }
    if (header !== gen.header) {
      if (await writeSketchFileSynced(spec.header, gen.header)) {
        updated.push(spec.header)
        usePageLink.getState().patch(kind, { header: gen.header })
      }
    }
  }
  if (updated.length) notify(`Код страницы обновлён (${updated.join(', ')}).`, { kind: 'ok' })
}

/** Какую страницу стоит подключить: есть элементы, файл сохранён или страницу правили, а include в скетче нет. */
export function unlinkedKind(s: Pick<LinkState, 'ui' | 'web'>): PageKind | null {
  if (s.ui.connected || s.web.connected) return null
  for (const k of KINDS) {
    const i = s[k]
    if (i.items > 0 && (i.json !== null || i.touched)) return k
  }
  return null
}
