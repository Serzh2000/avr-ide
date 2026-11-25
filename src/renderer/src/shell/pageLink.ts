// Связь «страница конструктора ↔ скетч»: что лежит на диске, подключена ли страница к скетчу, актуален ли сгенерированный код.
// Здесь же — тихое обновление *_generated.h перед сборкой и переход к проблеме в конструкторе.
import { create } from 'zustand'
import { parseSketch } from '../uibuilder/sketch/parse'
import { PAGE_SPECS } from '../uibuilder/sketch/integrate'
import type { PageKind } from '../uibuilder/sketch/integrate'
import { parseProject as parseWeb, serializeProject as serializeWeb } from '../webdesign/core/index'
import { webPlatformFor } from '../webdesign/core/targets'
import { parseProject as parseUi } from '../uibuilder/core/index'
import { useUiBuilder } from '../uibuilder/store'
import { useWebDesigner } from '../webdesign/store'
import { countPageItems, genPage, ledcApiFromHeader, ledcApiFromJson, serializeUiPage } from './pageGen'
import { writeSketchFileSynced } from './host'
import { setProjectDraftFlusher, useProject } from './project'
import { useUi } from './ui'
import { confirmDialog } from './dialogs'

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
  loading: boolean
  ui: KindInfo
  web: KindInfo
  /** Запрос конструктору: открыть окно «Вставить в скетч» (nonce меняется при каждом запросе). */
  insertRequest: { kind: PageKind; nonce: number } | null
  patch: (kind: PageKind, p: Partial<KindInfo>) => void
}

export const usePageLink = create<LinkState>((set) => ({
  root: null,
  loading: false,
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
let rootSeq = 0
let adopting = false
let connTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
const pending = new Map<string, Map<PageKind, string>>()
const inFlight = new Map<string, Promise<boolean>>()
const unreadable = new Set<PageKind>()
// Версия, из которой построен холст, не обязательно совпадает с последней прочитанной версией на диске.
const jsonBase: Record<PageKind, string | null> = { ui: null, web: null }
const jsonWrites: Partial<Record<PageKind, Promise<boolean>>> = {}

const ser = {
  ui: (): string => serializeUiPage(useUiBuilder.getState().project, useUiBuilder.getState().ledcApi),
  web: (): string => serializeWeb(useWebDesigner.getState().project)
}

async function readPageFiles(root: string): Promise<Record<PageKind, { json: string | null; header: string | null }>> {
  const [ui, uiHeader, web, webHeader] = await Promise.all([
    readIn(root, PAGE_SPECS.ui.json), readIn(root, PAGE_SPECS.ui.header),
    readIn(root, PAGE_SPECS.web.json), readIn(root, PAGE_SPECS.web.header)
  ])
  return { ui: { json: ui, header: uiHeader }, web: { json: web, header: webHeader } }
}

/** Обновляет сведения о диске; живую модель загружаем только при открытии проекта. */
export async function reloadPageFiles(): Promise<void> {
  const { root, loading } = usePageLink.getState()
  if (!root || loading) return
  const seq = ++diskSeq
  const got = await readPageFiles(root)
  if (seq !== diskSeq || useProject.getState().root !== root) return
  const st = usePageLink.getState()
  for (const k of KINDS) {
    const { json, header } = got[k]
    if (unreadable.has(k) && (json === null || (k === 'ui' ? parseUi(json) : parseWeb(json)).ok)) {
      unreadable.delete(k)
      if (pending.get(root)?.has(k)) scheduleSave(root)
    }
    const items = st[k].touched ? st[k].items : json === null ? 0 : countPageItems(k, json)
    st.patch(k, { json, header, items })
  }
  recomputeConnected()
}

function scheduleSave(root: string): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void flushPageDrafts(root) }, 500)
}

/** Общая запись для автосохранения, подключения и ручного обновления. */
export async function savePageJson(root: string | null, kind: PageKind, text: string): Promise<boolean> {
  if (!root) return false
  const seq = rootSeq
  const name = PAGE_SPECS[kind].json
  const pass = Promise.resolve(jsonWrites[kind]).then(async () => {
    const state = usePageLink.getState()
    if (seq !== rootSeq || state.root !== root || state.loading) return false
    if (unreadable.has(kind)) {
      useUi.getState().notify(`Не могу сохранить ${name} поверх повреждённого файла. Экспортируйте черновик или исправьте исходный JSON.`, { kind: 'error' })
      return false
    }
    const previous = jsonBase[kind]
    const doc = Object.entries(useProject.getState().docs).find(([path]) => path.toLowerCase() === pathIn(root, name).toLowerCase())?.[1]
    if (doc && doc.content !== doc.saved && doc.content !== text) {
      useUi.getState().notify(`${name} изменён в редакторе. Сохраните или отмените правки файла перед записью из конструктора.`, { kind: 'error' })
      return false
    }
    if (text === previous && (await readIn(root, name)) === previous) return true
    if (seq !== rootSeq || !await writeSketchFileSynced(root, name, text, previous)) return false
    if (seq !== rootSeq) return false
    jsonBase[kind] = text
    ++diskSeq
    usePageLink.getState().patch(kind, { json: text })
    return true
  })
  jsonWrites[kind] = pass
  try { return await pass }
  finally { if (jsonWrites[kind] === pass) delete jsonWrites[kind] }
}

/** Дописывает только черновики выбранной папки до закрытия, смены проекта или сборки. */
async function flushPageDrafts(root = useProject.getState().root): Promise<boolean> {
  if (!root || !pending.get(root)?.size) return true
  const current = inFlight.get(root)
  if (current) return current
  const drafts = pending.get(root)!
  const pass = (async (): Promise<boolean> => {
    while (drafts.size) {
      if (useProject.getState().root !== root) return false
      const [kind, text] = drafts.entries().next().value!
      if (!await savePageJson(root, kind, text)) return false
      if (drafts.get(kind) === text) drafts.delete(kind)
    }
    pending.delete(root)
    return true
  })()
  inFlight.set(root, pass)
  try {
    return await pass
  } finally {
    inFlight.delete(root)
  }
}

setProjectDraftFlusher(async () => {
  const root = useProject.getState().root
  if (await flushPageDrafts(root)) return true
  if (!root || useProject.getState().root !== root) return false
  const answer = await confirmDialog({
    title: 'Правки страницы не сохранены',
    message: 'Останьтесь в проекте, чтобы исправить файл или экспортировать страницу.',
    buttons: [
      { id: 'stay', label: 'Остаться в проекте', kind: 'primary' },
      { id: 'discard', label: 'Продолжить без правок страницы', kind: 'danger' }
    ]
  })
  if (answer !== 'discard' || useProject.getState().root !== root) return false
  pending.delete(root)
  return true
})

/** Загружает сохранённые модели или создаёт чистое состояние для папки без страниц. */
async function adoptRoot(root: string, seq: number): Promise<void> {
  const got = await readPageFiles(root)
  if (seq !== rootSeq || useProject.getState().root !== root) return
  const board = webPlatformFor(useUi.getState().fqbn)
  const platform = board === 'esp32' || board === 'esp8266' ? board : null
  const drafts = pending.get(root)
  const ui = drafts?.get('ui') ?? got.ui.json
  const web = drafts?.get('web') ?? got.web.json
  const ledc = (ui && ledcApiFromJson(ui)) || ledcApiFromHeader(got.ui.header)
  adopting = true
  try {
    const errors = {
      ui: useUiBuilder.getState().hydrateProject(ui, platform, ledc),
      web: useWebDesigner.getState().hydrateProject(web, board)
    }
    const st = usePageLink.getState()
    for (const k of KINDS) {
      if (errors[k]) {
        unreadable.add(k)
        useUi.getState().notify(`Файл ${PAGE_SPECS[k].json} не разобрать: ${errors[k]}. Исходный файл сохранён.`, { kind: 'error' })
      }
      const text = k === 'ui' ? ui : web
      jsonBase[k] = got[k].json
      st.patch(k, { ...got[k], touched: drafts?.has(k) === true, items: text === null || errors[k] ? 0 : countPageItems(k, text) })
    }
    recomputeConnected()
  } finally {
    adopting = false
    usePageLink.setState({ loading: false })
  }
  if (drafts?.size) scheduleSave(root)
}

useProject.subscribe((s, prev) => {
  if (s.root !== prev.root) {
    ++diskSeq
    const seq = ++rootSeq
    clearTimeout(saveTimer)
    clearTimeout(connTimer)
    unreadable.clear()
    jsonBase.ui = jsonBase.web = null
    usePageLink.setState({ root: s.root, loading: s.root !== null, ui: blank(), web: blank(), insertRequest: null })
    if (s.root) void adoptRoot(s.root, seq)
    return
  }
  if (s.tree !== prev.tree) void reloadPageFiles()
  const a = s.mainFile ? s.docs[s.mainFile]?.content : undefined
  const b = prev.mainFile ? prev.docs[prev.mainFile]?.content : undefined
  if (a !== b) {
    clearTimeout(connTimer)
    connTimer = setTimeout(recomputeConnected, 250)
  }
})

/** Снимок сохраняется с папкой, которой принадлежал в момент правки. */
function onModelChange(kind: PageKind, items: number): void {
  const st = usePageLink.getState()
  if (adopting || st.loading || !st.root) return
  st.patch(kind, { touched: true, items })
  const drafts = pending.get(st.root) ?? new Map<PageKind, string>()
  drafts.set(kind, ser[kind]())
  pending.set(st.root, drafts)
  scheduleSave(st.root)
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
    s.setView('issues')
  } else {
    const s = useWebDesigner.getState()
    if (targetId) s.select(targetId)
    s.setView('issues')
  }
}

/** «Подключить»: открыть конструктор и окно «Вставить в скетч». */
export function requestConnect(kind: PageKind): void {
  useProject.getState().openPanel(kind)
  usePageLink.setState({ insertRequest: { kind, nonce: Date.now() } })
}

/** Записать заголовок в исходную папку проекта. */
async function writePageHeader(root: string, kind: PageKind, header: string): Promise<string | null> {
  const spec = PAGE_SPECS[kind]
  const p = await writeSketchFileSynced(root, spec.header, header)
  if (!p) return null
  if (usePageLink.getState().root === root) usePageLink.getState().patch(kind, { header })
  return p
}

/**
 * Перед «Проверить»/«Загрузить»: если страница подключена к скетчу, а заголовок на диске устарел — тихо перегенерировать его
 * из сохранённой страницы. Ошибки в модели не глотаются: понятное сообщение с кнопкой «Открыть конструктор».
 * Ошибка записи останавливает сборку, чтобы в неё не попали старые файлы.
 */
export async function syncPagesBeforeBuild(fqbn: string): Promise<boolean> {
  const root = useProject.getState().root
  const code = mainCode()
  if (!root || code === null) return false
  if (!await flushPageDrafts(root) || useProject.getState().root !== root) return false
  if (!useUi.getState().settings.autoRegenPage) return true
  const board = webPlatformFor(fqbn)
  if (!board) return true
  const notify = useUi.getState().notify
  const updated: string[] = []
  for (const kind of KINDS) {
    if (kind === 'ui' && board === 'pico-w') continue
    if (!isConnected(kind, code)) continue
    const spec = PAGE_SPECS[kind]
    const json = await readIn(root, spec.json)
    if (json === null) continue
    const header = await readIn(root, spec.header)
    if (useProject.getState().root !== root) return false
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
      if (header === null && !(await writePageHeader(root, kind, gen.header))) return false
      notify(`Страница (${spec.title}) содержит ошибки: ${first.message}${more}. ${tail}`, {
        kind: 'error',
        action: { label: 'Открыть конструктор', run: () => openPageProblem(kind, first.targetId) }
      })
      continue
    }
    if (header !== gen.header) {
      if (!(await writePageHeader(root, kind, gen.header))) return false
      updated.push(spec.header)
    }
  }
  if (useProject.getState().root !== root) return false
  if (updated.length) notify(`Код страницы обновлён (${updated.join(', ')}).`, { kind: 'ok' })
  return true
}

/** Какую страницу стоит подключить: есть элементы, файл сохранён или страницу правили, а include в скетче нет. */
export function unlinkedKind(s: Pick<LinkState, 'ui' | 'web'>, allowEspUi = true): PageKind | null {
  if (s.ui.connected || s.web.connected) return null
  for (const k of KINDS) {
    if (k === 'ui' && !allowEspUi) continue
    const i = s[k]
    if (i.items > 0 && (i.json !== null || i.touched)) return k
  }
  return null
}
