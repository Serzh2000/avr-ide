// Валидатор проекта: ошибки блокируют корректную генерацию, предупреждения — нет.
import { BLOCKS, bindRule, isContainer } from './blocks'
import { identProblem, isBlockId, isColor, isSafeImageSrc, utf8Length, has } from './escape'
import { walk } from './factory'
import { checkPin } from './pins'
import type { PinRole } from './pins'
import { generateSite } from './site'
import type { Block, Issue, SiteOutput, WdProject } from './types'
import { PALETTE_KEYS } from './types'

/** Эвристические пороги размера страницы (не документированные лимиты библиотеки — практические ориентиры). */
export const SIZE_LIMITS = {
  esp8266: { warn: 24 * 1024, error: 96 * 1024 },
  esp32: { warn: 96 * 1024, error: 400 * 1024 }
}

const COLOR_FIELDS = ['bg', 'color', 'darkBg', 'darkColor', 'borderColor'] as const

export function validate(p: WdProject, site?: SiteOutput): Issue[] {
  const out: Issue[] = []
  const err = (code: string, message: string, extra: Partial<Issue> = {}): void => {
    out.push({ severity: 'error', code, message, ...extra })
  }
  const warn = (code: string, message: string, extra: Partial<Issue> = {}): void => {
    out.push({ severity: 'warning', code, message, ...extra })
  }

  // ---- страница / устройство ----
  if (!p.page.title.trim()) warn('title-empty', 'Не задан заголовок страницы')
  for (const k of PALETTE_KEYS) {
    if (!isColor(p.page.theme.light[k]) || !isColor(p.page.theme.dark[k])) err('palette-invalid', `Некорректный цвет палитры: ${k}`)
  }
  const d = p.device
  if (!/^\/[A-Za-z0-9_-]{1,31}$/.test(d.wsPath)) err('ws-path', 'Путь WebSocket: «/» и 1–31 символ из латиницы, цифр, _ и -')
  if (!Number.isInteger(d.port) || d.port < 1 || d.port > 65535) err('port', 'Порт должен быть целым числом 1–65535')
  if (!(d.updateMs >= 20)) err('update-ms', 'Период опроса — не менее 20 мс')
  if (p.platform === 'esp32' && (!Number.isInteger(d.pwmBits) || d.pwmBits < 1 || d.pwmBits > 16))
    err('pwm-bits', 'Разрядность PWM ESP32: 1–16')
  const w = p.wifi
  if (p.wifi.mode === 'sta' && !w.ssid) warn('wifi-ssid', 'Не задан SSID сети — устройство поднимет точку доступа')
  if (w.ssid.length > 32 || w.apSsid.length > 32) err('wifi-ssid-len', 'SSID длиннее 32 символов')
  if (w.password && (w.password.length < 8 || w.password.length > 63)) err('wifi-pass-len', 'Пароль WiFi: 8–63 символа')
  if (w.apPassword && (w.apPassword.length < 8 || w.apPassword.length > 63)) err('ap-pass-len', 'Пароль точки доступа: пусто или 8–63 символа')
  if (!w.apSsid) err('ap-ssid', 'Не задан SSID точки доступа')
  if (!/^[A-Za-z0-9-]{1,32}$/.test(w.hostname)) err('hostname', 'Имя хоста: 1–32 символа из латиницы, цифр и -')

  // ---- переменные ----
  const varNames = new Map<string, number>()
  for (const v of p.variables) {
    const prob = identProblem(v.name)
    if (prob) err('var-name', `Переменная «${v.name}»: ${prob}`, { variable: v.name })
    varNames.set(v.name, (varNames.get(v.name) ?? 0) + 1)
    const s = v.init.trim()
    if (s !== '') {
      const bad =
        (v.type === 'bool' && s !== 'true' && s !== 'false') ||
        (v.type === 'int' && !/^-?\d+$/.test(s)) ||
        (v.type === 'float' && !Number.isFinite(Number(s)))
      if (bad) err('var-init', `Переменная «${v.name}»: начальное значение «${v.init}» не подходит типу ${v.type}`, { variable: v.name })
    }
  }
  for (const [n, c] of varNames) if (c > 1) err('var-duplicate', `Переменная «${n}» объявлена ${c} раза`, { variable: n })

  // ---- блоки ----
  const ids = new Map<string, number>()
  const used = new Set<string>()
  const pinUse = new Map<number, Array<{ dir: string; mode: string; id: string }>>()
  let nBlocks = 0
  walk(p.blocks, (b: Block, parent: Block | null, depth: number) => {
    nBlocks++
    if (!has(BLOCKS, b.type)) {
      err('block-type', `Неизвестный тип блока «${String(b.type)}»`, { blockId: b.id })
      return
    }
    const at = { blockId: b.id }
    if (!isBlockId(b.id)) err('id-invalid', `Некорректный id «${b.id}»: латиница, цифры, _ и -, первый символ — буква`, at)
    ids.set(b.id, (ids.get(b.id) ?? 0) + 1)
    if (depth > 8) warn('deep', `Слишком глубокая вложенность блока «${b.id}»`, at)
    if (b.type === 'section' && parent) err('section-nested', `Секция «${b.id}» может быть только на верхнем уровне`, at)
    if (b.children.length && !isContainer(b.type)) err('leaf-children', `Блок «${b.id}» (${BLOCKS[b.type].title}) не может содержать вложенные блоки`, at)

    // стили
    for (const f of COLOR_FIELDS) {
      const c = b.style[f]
      if (c !== undefined && !isColor(c)) err('color-invalid', `Блок «${b.id}»: некорректный цвет ${f}: «${String(c)}»`, at)
    }
    for (const g of [b.style.gradient, b.style.darkGradient]) {
      if (g && (!isColor(g.from) || !isColor(g.to))) err('color-invalid', `Блок «${b.id}»: некорректный цвет градиента`, at)
    }
    for (const c of [b.style.hover?.bg, b.style.hover?.color]) {
      if (c !== undefined && !isColor(c)) err('color-invalid', `Блок «${b.id}»: некорректный цвет hover`, at)
    }

    // свойства
    const pr = b.props
    if (b.type === 'grid' && (!(pr.columns! >= 1) || pr.columns! > 12)) err('columns', `Сетка «${b.id}»: колонок 1–12`, at)
    if (b.type === 'slider' || b.type === 'gauge' || b.type === 'progress' || b.type === 'chart') {
      if (!(Number(pr.min) < Number(pr.max))) err('range', `Блок «${b.id}»: min должен быть меньше max`, at)
    }
    if (b.type === 'slider' && !(Number(pr.step) > 0)) err('step', `Ползунок «${b.id}»: шаг должен быть больше 0`, at)
    if (b.type === 'chart' && !(Number(pr.points) >= 5 && Number(pr.points) <= 600)) err('points', `График «${b.id}»: точек 5–600`, at)
    if (b.type === 'heading' && !(Number(pr.level) >= 1 && Number(pr.level) <= 4)) err('level', `Заголовок «${b.id}»: уровень 1–4`, at)
    if (b.type === 'image') {
      if (!pr.src) warn('image-empty', `Изображение «${b.id}» без источника`, at)
      else if (!isSafeImageSrc(pr.src)) err('image-src', `Изображение «${b.id}»: допустимы data:image/...;base64 или относительный путь (внешние URL запрещены)`, at)
      else if (pr.src.startsWith('data:') && pr.src.length > 30000) warn('image-big', `Изображение «${b.id}» велико (${Math.round(pr.src.length / 1024)} КБ в base64) — для ESP лучше SVG или небольшой PNG`, at)
    }
    if (b.type === 'icon' && !pr.icon) warn('icon-empty', `Иконка «${b.id}» без выбранного значка`, at)
    if (b.type === 'button' && pr.action === 'send' && b.binding.kind === 'var') {
      const v = p.variables.find((x) => x.name === (b.binding as { variable: string }).variable)
      if (v && (v.type === 'int' || v.type === 'float') && !Number.isFinite(Number(pr.value ?? ''))) warn('button-value', `Кнопка «${b.id}»: значение «${pr.value ?? ''}» не число`, at)
    }
    if (b.type === 'input' && pr.inputType === 'number' && b.binding.kind === 'var') {
      const v = p.variables.find((x) => x.name === (b.binding as { variable: string }).variable)
      if (v?.type === 'String') warn('input-type', `Поле «${b.id}»: числовое поле привязано к String`, at)
    }

    // привязки
    const bd = b.binding
    const rule = bindRule(b.type)
    if (bd.kind !== 'none' && !rule) err('bind-unsupported', `Блок «${b.id}» (${BLOCKS[b.type].title}) не поддерживает привязки`, at)
    else if (bd.kind === 'var' && rule) {
      used.add(bd.variable)
      const v = p.variables.find((x) => x.name === bd.variable)
      if (!v) err('var-undefined', `Блок «${b.id}»: переменная «${bd.variable}» не объявлена`, { ...at, variable: bd.variable })
      else if (!rule.vars.includes(v.type))
        err('var-type', `Блок «${b.id}» (${BLOCKS[b.type].title}) требует переменную типа ${rule.vars.join('/')}, а «${v.name}» — ${v.type}`, { ...at, variable: v.name })
      if (!rule.dirs.includes(bd.direction))
        err('dir-invalid', `Блок «${b.id}»: направление «${bd.direction}» не подходит (${rule.dirs.join('/')})`, at)
    } else if (bd.kind === 'pin' && rule) {
      const pr2 = rule.pins.find((x) => x.direction === bd.direction)
      if (!pr2) err('pin-dir', `Блок «${b.id}»: направление «${bd.direction}» для пина не подходит`, at)
      else if (!pr2.modes.includes(bd.mode)) err('pin-mode', `Блок «${b.id}»: режим «${bd.mode}» для пина не подходит`, at)
      const role: PinRole = bd.direction === 'toPin' ? (bd.mode === 'analog' ? 'out-pwm' : 'out-digital') : bd.mode === 'analog' ? 'in-analog' : 'in-digital'
      for (const pp of checkPin(p.platform, bd.pin, role)) out.push({ severity: pp.severity, code: pp.code, message: `Блок «${b.id}»: ${pp.message}`, blockId: b.id })
      const l = pinUse.get(bd.pin) ?? []
      l.push({ dir: bd.direction, mode: bd.mode, id: b.id })
      pinUse.set(bd.pin, l)
      if (b.type === 'slider' && bd.mode === 'analog' && Number(pr.max) > (p.platform === 'esp32' ? 2 ** d.pwmBits - 1 : 1023))
        warn('pwm-range', `Ползунок «${b.id}»: max больше диапазона PWM (${p.platform === 'esp32' ? 2 ** d.pwmBits - 1 : 1023})`, at)
    } else if (bd.kind === 'none' && rule && ['button', 'switch', 'slider', 'input', 'color', 'sensor', 'indicator', 'gauge', 'progress', 'chart'].includes(b.type)) {
      warn('unbound', `Блок «${b.id}» (${BLOCKS[b.type].title}) не привязан к переменной или пину`, at)
    }
  })
  for (const [id, c] of ids) if (c > 1) err('id-duplicate', `id «${id}» используется ${c} раза`, { blockId: id })

  // конфликты пинов
  const analogOut: number[] = []
  for (const [pin, uses] of pinUse) {
    const modes = new Set(uses.map((u) => u.mode))
    const dirs = new Set(uses.map((u) => u.dir))
    if (modes.size > 1) err('pin-conflict', `GPIO${pin}: используется и как digital, и как analog`, { blockId: uses[0].id })
    if (dirs.size > 1) err('pin-conflict', `GPIO${pin}: используется и как выход, и как вход`, { blockId: uses[0].id })
    if (uses.some((u) => u.dir === 'toPin' && u.mode === 'analog')) analogOut.push(pin)
  }
  if (p.platform === 'esp32' && analogOut.length > 16) err('pwm-channels', 'На ESP32 не более 16 PWM-каналов (LEDC)')

  for (const v of p.variables) if (!used.has(v.name)) warn('var-unused', `Переменная «${v.name}» не привязана ни к одному блоку`, { variable: v.name })
  if (nBlocks === 0) warn('empty', 'Страница пуста — добавьте блоки')
  if (nBlocks > 300) warn('many-blocks', `Блоков: ${nBlocks}. Большая страница тяжела для браузера и памяти ESP`)

  // размер страницы
  const s = site ?? generateSite(p)
  const size = utf8Length(s.bundle)
  const lim = SIZE_LIMITS[p.platform]
  const kb = (size / 1024).toFixed(1)
  if (size >= lim.error)
    err('page-size', `Страница ${kb} КБ — слишком велика для ${p.platform.toUpperCase()} (ориентир: до ${Math.round(lim.error / 1024)} КБ). Уберите картинки/блоки`)
  else if (size >= lim.warn)
    warn('page-size-warn', `Страница ${kb} КБ — для ${p.platform.toUpperCase()} желательно уложиться в ${Math.round(lim.warn / 1024)} КБ (страница лежит во флеше и отдаётся без сжатия)`)
  return out
}

export function pageSize(site: SiteOutput): number {
  return utf8Length(site.bundle)
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}
