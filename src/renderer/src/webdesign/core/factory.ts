// Фабрики и операции над деревом блоков (все — чистые функции, без мутации входных данных там, где это указано).
import { BLOCKS, isContainer } from './blocks'
import type {
  Binding, Block, BlockType, DeviceSettings, PageSettings, Palette, Platform, Theme, WdProject, WifiSettings
} from './types'
import { WD_VERSION } from './types'

export const LIGHT_PALETTE: Palette = {
  bg: '#f5f6f8',
  surface: '#ffffff',
  text: '#1d2330',
  muted: '#5f6776',
  primary: '#4f46e5',
  accent: '#0f766e',
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
  border: '#dfe2e8'
}

export const DARK_PALETTE: Palette = {
  bg: '#12141a',
  surface: '#1a1d25',
  text: '#e6e8ee',
  muted: '#98a0b0',
  primary: '#8b93ff',
  accent: '#5eead4',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#f87171',
  border: '#2a2f3b'
}

export function defaultTheme(): Theme {
  return {
    mode: 'auto',
    toggle: true,
    light: { ...LIGHT_PALETTE },
    dark: { ...DARK_PALETTE },
    font: 'sans',
    baseSize: 16,
    radius: 10,
    maxWidth: 1100
  }
}

export function defaultPage(): PageSettings {
  return {
    title: 'ESP — панель управления',
    lang: 'ru',
    description: '',
    theme: defaultTheme(),
    tablet: 900,
    mobile: 600,
    showStatus: true,
    reconnectMs: 5000
  }
}

export function defaultWifi(): WifiSettings {
  return { mode: 'sta', ssid: '', password: '', apSsid: 'ESP-Web', apPassword: '', hostname: 'esp-web' }
}

export function defaultDevice(): DeviceSettings {
  return {
    wsPath: '/ws',
    port: 80,
    updateMs: 200,
    pwmFreq: 5000,
    pwmBits: 8,
    ledcApi: 'v3',
    serveApi: 'send',
    serialLog: true
  }
}

export function createProject(platform: Platform = 'esp32'): WdProject {
  const page = defaultPage()
  const wifi = defaultWifi()
  if (platform === 'pico-w') {
    page.title = 'Pico W — панель управления'
    wifi.apSsid = 'Pico-Web'
    wifi.hostname = 'pico-web'
  }
  return {
    version: WD_VERSION,
    platform,
    page,
    wifi,
    device: defaultDevice(),
    variables: [],
    pages: [{ id: 'main', title: 'Главная' }],
    blocks: []
  }
}

/** Новый проект с одной секцией-заготовкой. */
export function createDefaultProject(platform: Platform = 'esp32'): WdProject {
  const p = createProject(platform)
  const sec = createBlock('section', 'main')
  const h = createBlock('heading', 'title')
  h.props.text = 'Моё устройство'
  h.props.level = 1
  sec.children.push(h)
  p.blocks.push(sec)
  return p
}

export function defaultBinding(): Binding {
  return { kind: 'none' }
}

export function createBlock(type: BlockType, id: string): Block {
  const d = BLOCKS[type]
  return {
    id,
    type,
    props: JSON.parse(JSON.stringify(d.props)),
    style: JSON.parse(JSON.stringify(d.style)),
    binding: defaultBinding(),
    children: []
  }
}

/** Блок вместе с его заготовленными детьми (вкладки, навбар…); id детей уникальны в проекте p. */
export function createBlockTree(p: WdProject, type: BlockType): Block {
  const used = allIds(p)
  const fresh = (t: string): string => {
    let n = 1
    while (used.has(`${t}${n}`)) n++
    used.add(`${t}${n}`)
    return `${t}${n}`
  }
  const make = (t: BlockType, props?: Block['props']): Block => {
    const b = createBlock(t, fresh(t))
    if (props) b.props = { ...b.props, ...props }
    for (const c of BLOCKS[t].defaultChildren ?? []) b.children.push(make(c.type, c.props))
    return b
  }
  return make(type)
}

// ---------- дерево ----------

export function walk(blocks: Block[], fn: (b: Block, parent: Block | null, depth: number) => void, parent: Block | null = null, depth = 0): void {
  for (const b of blocks) {
    fn(b, parent, depth)
    walk(b.children, fn, b, depth + 1)
  }
}

export function allBlocks(p: WdProject): Block[] {
  const out: Block[] = []
  walk(p.blocks, (b) => out.push(b))
  return out
}

export function allIds(p: WdProject): Set<string> {
  return new Set(allBlocks(p).map((b) => b.id))
}

export function findBlock(p: WdProject, id: string): Block | null {
  let found: Block | null = null
  walk(p.blocks, (b) => {
    if (b.id === id) found = b
  })
  return found
}

export function findParent(p: WdProject, id: string): Block | null {
  let found: Block | null = null
  walk(p.blocks, (b, parent) => {
    if (b.id === id) found = parent
  })
  return found
}

/** Свободный id вида <type><N>. */
export function uniqueId(p: WdProject, type: string): string {
  const used = allIds(p)
  let n = 1
  while (used.has(`${type}${n}`)) n++
  return `${type}${n}`
}

/** Список, в котором лежит блок (корень или children родителя), и его индекс. */
function locate(p: WdProject, id: string): { list: Block[]; index: number } | null {
  const search = (list: Block[]): { list: Block[]; index: number } | null => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return { list, index: i }
      const r = search(list[i].children)
      if (r) return r
    }
    return null
  }
  return search(p.blocks)
}

/** Добавить блок: в контейнер parentId (или в корень), на позицию index (по умолчанию — в конец). Мутирует p. */
export function addBlock(p: WdProject, block: Block, parentId: string | null, index?: number): void {
  const list = parentId ? (findBlock(p, parentId)?.children ?? p.blocks) : p.blocks
  list.splice(index ?? list.length, 0, block)
}

export function removeBlock(p: WdProject, id: string): Block | null {
  const loc = locate(p, id)
  if (!loc) return null
  return loc.list.splice(loc.index, 1)[0]
}

/** Сдвиг внутри родителя на delta (−1 вверх, +1 вниз). */
export function shiftBlock(p: WdProject, id: string, delta: number): void {
  const loc = locate(p, id)
  if (!loc) return
  const to = loc.index + delta
  if (to < 0 || to >= loc.list.length) return
  const [b] = loc.list.splice(loc.index, 1)
  loc.list.splice(to, 0, b)
}

/** Является ли candidate потомком (или самим) блока id. */
export function isInside(p: WdProject, id: string, candidate: string): boolean {
  const b = findBlock(p, id)
  if (!b) return false
  let hit = false
  walk([b], (x) => {
    if (x.id === candidate) hit = true
  })
  return hit
}

/** Переместить блок в контейнер (или в корень). Запрещает вложение в себя/потомка и в не-контейнер. */
export function moveBlock(p: WdProject, id: string, parentId: string | null, index?: number): boolean {
  if (parentId) {
    if (isInside(p, id, parentId)) return false
    const par = findBlock(p, parentId)
    if (!par || !isContainer(par.type)) return false
  }
  const b = removeBlock(p, id)
  if (!b) return false
  addBlock(p, b, parentId, index)
  return true
}

/** Глубокая копия поддерева с новыми id. */
export function cloneBlock(p: WdProject, b: Block): Block {
  const used = allIds(p)
  const copy = (src: Block): Block => {
    let n = 2
    const base = src.id.replace(/\d+$/, '') || src.type
    let id = `${base}${n}`
    while (used.has(id)) id = `${base}${++n}`
    used.add(id)
    const c: Block = JSON.parse(JSON.stringify({ ...src, children: [] }))
    c.id = id
    c.children = src.children.map(copy)
    return c
  }
  return copy(b)
}

/** Переименовать блок (id не должен быть занят — это проверяет вызывающий/валидатор). */
export function renameBlock(p: WdProject, id: string, newId: string): void {
  const b = findBlock(p, id)
  if (b) b.id = newId
}

/** Ключ пина в WebSocket-протоколе. */
export function pinKey(pin: number): string {
  return `gpio${pin}`
}

/** Ключ привязки блока в протоколе либо null. */
export function bindingKey(b: Binding): string | null {
  if (b.kind === 'var') return b.variable
  if (b.kind === 'pin') return pinKey(b.pin)
  return null
}
