// Генерирует src/renderer/src/reference/data/boardArt.ts — готовые векторные рисунки плат и точные координаты выводов.
//   node scripts/build-board-art.mjs <папка @wokwi/elements/dist/esm> <папка с файлами Fritzing> <папка с файлами Raspberry Pi: pico.svg, picow.svg, pico2.svg>
// Источники и лицензии (см. licenses/THIRD_PARTY.md):
//   • @wokwi/elements 1.9.2 (MIT, © Uri Shaked) — Arduino Uno, Nano, Mega, ESP32 DevKit V1: разметка SVG и pinInfo;
//   • fritzing-parts (рисунки CC BY-SA 3.0, © Fritzing) — Arduino Leonardo, Pro Mini, WeMos D1 mini, STM32 Nucleo-64: *_breadboard.svg и .fzp;
//   • Raspberry Pi Ltd, официальные детали Fritzing (из даташитов Pico, Pico W, Pico 2; лицензия «Permission to use, copy, modify, and/or distribute…», ISC-подобная): breadboard-рисунки;
//   • Blue Pill, Black Pill, Nucleo-32 — собственная отрисовка (ниже), по размерам и порядку выводов из документации.
// Координаты в итоговых данных — в миллиметрах от левого верхнего угла платы; рисунок вставляется как <image> (data URI),
// поэтому стили и идентификаторы рисунков изолированы от интерфейса.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const wokwiDir = process.argv[2]
const fzDir = process.argv[3]
const piDir = process.argv[4]
if (!wokwiDir || !fzDir || !piDir) throw new Error('usage: build-board-art.mjs <wokwi esm dir> <fritzing dir> <raspberry pi svg dir>')
const PX = 25.4 / 96 // мм на CSS-пиксель
const PT = 25.4 / 72 // мм на пункт (единица рисунков Fritzing)

const out = {}
// Уже сгенерированные записи: если исходник рисунка недоступен (см. fritzing() ниже), запись сохраняется как есть.
const prev = (() => { try { const t = readFileSync(join(process.cwd(), 'src/renderer/src/reference/data/boardArt.ts'), 'utf8'); return JSON.parse(t.slice(t.indexOf('boardArt: Record<string, BoardArt> = ') + 36)) } catch { return {} } })()

// ---------- Wokwi ----------
function wokwi(id, file, opts) {
  const src = readFileSync(join(wokwiDir, file), 'utf8')
  const r = src.slice(src.indexOf('render() {'))
  const a = r.indexOf('<svg')
  const b = r.indexOf('</svg>') + 6
  let svg = r.slice(a, b)
  const female = readFileSync(join(wokwiDir, 'patterns/pins-female.js'), 'utf8')
  const pattern = female.slice(female.indexOf('svg `') + 5, female.lastIndexOf('`;'))
  svg = svg.replace('${pinsFemalePattern}', pattern)
  // обработчики событий и светодиоды (в статике выключены)
  const cssAt = src.indexOf('static get styles()')
  const css = cssAt >= 0 ? src.slice(src.indexOf('css `', cssAt) + 5, src.indexOf('`;', cssAt)) : ''
  svg = svg.replace(/@\w+=\$\{[^}]*\}/g, '')
  svg = svg.replace(/\$\{\s*(?:led\w*|ledPower)\s*&&\s*svg\s*`[^`]*`\s*\}/g, '')
  svg = svg.replace(/\$\{([^}`]*)\}/g, (_, e) => String(Function('return (' + e + ')')()))
  if (svg.includes('${')) throw new Error(id + ': остались выражения шаблона')
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  svg = svg.replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1').replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1')
  if (css) svg = svg.replace(/(<svg[^>]*>)/, '$1<style>' + css.replace(/\s+/g, ' ') + '</style>')
  const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number)
  const k = opts.k
  const pinsText = src.slice(src.indexOf('this.pinInfo = [') + 15)
  const arr = pinsText.slice(0, pinsText.indexOf('];') + 1)
  const stub = (t) => (...args) => ({ t, args })
  const pinInfo = Function('analog', 'i2c', 'spi', 'usart', 'return ' + arr)(stub('a'), stub('i'), stub('s'), stub('u'))
  const pins = {}
  for (const p of pinInfo) {
    if (p.noBreadboard) continue
    pins[p.name] = [round(opts.px ? p.x * PX + vb[0] : p.x * k), round(opts.px ? p.y * PX : p.y * k)]
  }
  const fix = opts.vbFix
  const view = fix ? fix(vb) : vb
  svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${view.join(' ')}"`)
  out[id] = { svg: svg.replace(/\s+/g, ' '), x: round(view[0] * k), y: round(view[1] * k), w: round(view[2] * k), h: round(view[3] * k), pins, license: 'MIT, © Uri Shaked, @wokwi/elements' }
}
const round = (n) => Math.round(n * 1000) / 1000

wokwi('uno', 'arduino-uno-element.js', { k: 1, px: true, ox: 0, oy: 0 })
wokwi('nano', 'arduino-nano-element.js', { k: 1, px: true, ox: 0, oy: 0 })
wokwi('mega', 'arduino-mega-element.js', { k: 1, px: true, ox: 0, oy: 0 })
wokwi('esp32-devkit', 'esp32-devkit-v1-element.js', { k: 28.2 / 107, px: false, ox: 0, oy: 0 })

// ---------- Fritzing ----------
const mat = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
  apply: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}
function parseTransform(t) {
  let m = mat.id()
  for (const [, fn, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args.split(/[\s,]+/).filter(Boolean).map(Number)
    let n
    if (fn === 'translate') n = [1, 0, 0, 1, v[0], v[1] ?? 0]
    else if (fn === 'scale') n = [v[0], 0, 0, v[1] ?? v[0], 0, 0]
    else if (fn === 'rotate') {
      const c = Math.cos((v[0] * Math.PI) / 180), s = Math.sin((v[0] * Math.PI) / 180)
      n = [c, s, -s, c, 0, 0]
      if (v.length === 3) n = mat.mul(mat.mul([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]])
    } else if (fn === 'matrix') n = v
    else continue
    m = mat.mul(m, n)
  }
  return m
}
function fritzingPins(svg) {
  const pins = {}
  const stack = [mat.id()]
  for (const m of svg.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, selfClose] = m
    if (tag === 'g') {
      if (close) stack.pop()
      else {
        const t = /transform="([^"]*)"/.exec(attrs)
        stack.push(t ? mat.mul(stack[stack.length - 1], parseTransform(t[1])) : stack[stack.length - 1])
        if (selfClose) stack.pop()
      }
    } else if (tag === 'circle' && !close) {
      const id = /id="connector(\d+)pin"/.exec(attrs)
      if (id) {
        const cx = Number(/cx="([^"]+)"/.exec(attrs)[1]), cy = Number(/cy="([^"]+)"/.exec(attrs)[1])
        pins[id[1]] = mat.apply(stack[stack.length - 1], cx, cy)
      }
    }
  }
  return pins
}
function fritzing(id, svgFile, fzpFile) {
  try { readFileSync(join(fzDir, svgFile)) } catch { if (prev[id]) { out[id] = prev[id]; console.log(id, '— исходник недоступен, оставлена прежняя запись'); return } throw new Error('нет ' + svgFile) }
  let svg = readFileSync(join(fzDir, svgFile), 'utf8')
  const fzp = readFileSync(join(fzDir, fzpFile), 'utf8')
  const names = {}
  for (const c of fzp.matchAll(/<connector\b([^>]*)>([\s\S]*?)<\/connector>/g)) {
    const n = /name=["']([^"']*)/.exec(c[1])
    const bb = /<breadboardView>[\s\S]*?svgId=["']connector(\d+)pin/.exec(c[2]) ?? /id=["']connector(\d+)/.exec(c[1])
    if (bb && n) names[bb[1]] = n[1]
  }
  const raw = fritzingPins(svg)
  const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number)
  const pins = {}
  for (const [cid, [x, y]] of Object.entries(raw)) {
    let name = names[cid] ?? 'connector' + cid
    if (pins[name]) name += '.' + cid
    pins[name] = [round(x * PT), round(y * PT)]
  }
  svg = svg.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '')
  svg = svg.replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/, '$1').replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/, '$1')
  out[id] = { svg: svg.replace(/\s+/g, ' ').trim(), x: 0, y: 0, w: round(vb[2] * PT), h: round(vb[3] * PT), pins, license: 'CC BY-SA 3.0, © Fritzing (fritzing-parts)' }
}
fritzing('leonardo', 'Arduino_Leonardo_Rev3_breadboard.svg', 'Arduino_Leonardo_Rev3(fix).fzp')
fritzing('promini', 'Arduino-Pro-Mini_breadboard.svg', 'Arduino-Pro-Mini_5v-v14.fzp')
fritzing('wemos-d1-mini', 'd1mini.svg', 'WeMos-D1-mini-male-headers-above_fixed.fzp')


// ---------- Raspberry Pi Pico / Pico W / Pico 2 (официальные детали Fritzing от Raspberry Pi Ltd) ----------
// Сетка выводов одинакова у всех трёх: viewBox 59.53 × 150.24 pt = 21 × 53 мм (USB выступает на 2 мм), шаг 2.54, ряды 17.78 мм.
function pico(id, file, license) {
  let svg = readFileSync(join(piDir, file), 'utf8')
  svg = svg.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '')
  svg = svg.replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/, '$1').replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/, '$1')
  const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number)
  const W = 21, H = round((vb[3] / vb[2]) * 21)
  const pins = {}
  const x0 = round(((59.5275574 - (17.78 * 72) / 25.4) / 2 / 59.5275574) * 21), y1 = round((9.54 / 150.2362) * 53)
  for (let n = 1; n <= 40; n++) pins['p' + n] = n <= 20 ? [x0, round(y1 + (n - 1) * 2.54)] : [round(W - x0), round(y1 + (40 - n) * 2.54)]
  out[id] = { svg: svg.replace(/\s+/g, ' ').trim(), x: 0, y: 0, w: W, h: H, pins, license }
}
const PI_LIC = 'ISC-подобная (Permission to use, copy, modify, and/or distribute), © Raspberry Pi Ltd'
pico('pico', 'pico.svg', PI_LIC)
pico('picow', 'picow.svg', PI_LIC)
pico('pico2', 'pico2.svg', PI_LIC)

// ---------- STM32 Nucleo-64 (fritzing-parts, CC BY-SA 3.0): рисунок с координатами разъёмов; масштаб схемы K ----------
const NK = 1.7
{
  let svg = readFileSync(join(fzDir, 'STM32_Nucleo_board_breadboard.svg'), 'utf8')
  svg = svg.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '')
  svg = svg.replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/, '$1').replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/, '$1')
  // подписи Arduino-разъёмов из рисунка убираем: поверх рисуем собственные подписи выводов
  const DROP = new Set(['SCK/D13', 'MISO/D12', 'PWM/MOSI/D11', 'PWM/CS/D10', 'PWM/D9', 'D8', 'D7', 'PWM/D6', 'PWM/D5', 'D4', 'PWM/D3', 'D2', 'RX/D0', 'TX/D1', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCL', 'SDA', 'AVDD', 'IOREF', 'RESET', '3V3', 'VIN', '5V'])
  const DROP_IDS = new Set(['_x30_.1.0.2.6.0.0.0.0.0.0.0', '_x30_.1.0.2.22.0.0.0', '_x30_.1.0.2.23.0.0.0'])
  let dropped = 0 // (счётчик для отладки)
  svg = svg.replace(/<text[^>]*>[\s\S]*?<\/text>/g, (m) => {
    const id = /id="([^"]*)"/.exec(m)?.[1]
    const txt = m.replace(/<[^>]+>/g, '').trim()
    if (DROP.has(txt) || (id && DROP_IDS.has(id))) { dropped++; return '' }
    return m
  })
  const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number)
  const mm = (v) => round(v * PT * NK)
  const pins = {}
  // Morpho: 4 ряда по 19, шаг 7.2 пт; верхняя пара — CN10, нижняя — CN7 (плата повёрнута, ST-LINK слева)
  const XS = 93.3, STEP = 7.2
  for (let i = 0; i < 19; i++) {
    const x = XS + i * STEP
    pins[`CN10:${2 * i + 2}`] = [mm(x), mm(9.2)]
    pins[`CN10:${2 * i + 1}`] = [mm(x), mm(16.4)]
    pins[`CN7:${2 * i + 2}`] = [mm(x), mm(181.9)]
    pins[`CN7:${2 * i + 1}`] = [mm(x), mm(189.1)]
  }
  // Arduino-разъёмы: координаты кружков из рисунка
  const names = { 1151: 'D8', 1152: 'D9', 1153: 'D10', 1154: 'D11', 1155: 'D12', 1156: 'D13', 1157: 'GND.a', 1158: 'AREF', 1159: 'D14', 1160: 'D15', 1161: 'D0', 1162: 'D1', 1163: 'D2', 1164: 'D3', 1165: 'D4', 1166: 'D5', 1167: 'D6', 1168: 'D7', 1184: 'IOREF', 1191: 'NC.a', 1185: 'RESET', 1186: '3V3', 1187: '5V', 1188: 'GND.b', 1189: 'GND.c', 1190: 'VIN', 110: 'A0', 111: 'A1', 112: 'A2', 113: 'A3', 114: 'A4', 115: 'A5' }
  for (const m of svg.matchAll(/<circle id="connector(\d+)pin"[^>]*?cx="([\d.]+)" cy="([\d.]+)"/g)) if (names[m[1]]) pins[names[m[1]]] = [mm(+m[2]), mm(+m[3])]
  out['nucleo64'] = { svg: svg.replace(/\s+/g, ' ').trim(), x: 0, y: 0, w: mm(vb[2]), h: mm(vb[3]), pins, license: 'CC BY-SA 3.0, © Fritzing (fritzing-parts), масштаб схемы ×' + NK }
}

// ---------- собственные рисунки: Blue Pill, Black Pill, Nucleo-32 (мм, вид сверху) ----------
const OWN_LIC = 'собственная отрисовка (AVR IDE), размеры и порядок выводов по документации'
const f2 = (n) => Math.round(n * 100) / 100
const T = (x, y, t, o = {}) => `<text x="${f2(x)}" y="${f2(y)}" font-family="Arial,Helvetica,sans-serif" font-size="${o.s ?? 1.35}" fill="${o.c ?? '#f1f1ea'}" text-anchor="${o.a ?? 'middle'}"${o.r ? ` transform="rotate(${o.r} ${f2(x)} ${f2(y)})"` : ''} font-weight="${o.w ?? 400}">${t}</text>`
const R = (x, y, w, h, fill, o = {}) => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${o.rx ?? 0}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 0.15}"` : ''}/>`
const C = (x, y, r, fill, o = {}) => `<circle cx="${f2(x)}" cy="${f2(y)}" r="${r}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 0.15}"` : ''}/>`
const DEFS = '<defs><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eceff2"/><stop offset="1" stop-color="#a4a9b0"/></linearGradient><linearGradient id="mk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ced4"/><stop offset="1" stop-color="#868c95"/></linearGradient><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d77a"/><stop offset="1" stop-color="#b8962e"/></linearGradient></defs>'
const pad = (x, y) => C(x, y, 1.25, 'url(#gd)', { stroke: '#7a6420', sw: 0.12 }) + C(x, y, 0.55, '#0b0c0e')
const led = (x, y, c) => R(x - 0.8, y - 0.45, 1.6, 0.9, c, { stroke: '#000', sw: 0.08 }) + `<circle cx="${x}" cy="${y}" r="1.2" fill="${c}" opacity="0.18"/>`
const smd = (x, y, w, h) => R(x, y, w, h, '#c9b27a', { stroke: '#5a4a22', sw: 0.06 })
const btn = (x, y) => R(x - 1.9, y - 1.9, 3.8, 3.8, 'url(#mt)', { rx: 0.4, stroke: '#5b6068', sw: 0.12 }) + C(x, y, 1.15, '#2d3036', { stroke: '#000', sw: 0.08 })
const qfp = (cx, cy, s, rot, label) => `<g transform="rotate(${rot} ${cx} ${cy})"><rect x="${f2(cx - s / 2 - 0.6)}" y="${f2(cy - s / 2 - 0.6)}" width="${f2(s + 1.2)}" height="${f2(s + 1.2)}" fill="none" stroke="#b9bec5" stroke-width="0.75" stroke-dasharray="0.3 0.34"/>${R(cx - s / 2, cy - s / 2, s, s, '#1b1d20', { rx: 0.25, stroke: '#000', sw: 0.08 })}${C(cx - s / 2 + 0.9, cy - s / 2 + 0.9, 0.3, '#5a5f66')}${label ? T(cx, cy + 0.35, label, { s: 0.9, c: '#8b9199', w: 700 }) : ''}</g>`
const usbMicro = (x, y) => `<g>${R(x, y, 7.4, 5.6, 'url(#mt)', { rx: 0.3, stroke: '#6b7078', sw: 0.12 })}${R(x - 0.1, y + 1.3, 5.2, 3, '#14161a', { rx: 0.3 })}${R(x + 0.3, y + 2.1, 3.8, 1.3, '#3b3f46')}</g>`
const svgDoc = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${DEFS}${body}</svg>`

/** Две гребёнки: top/bot — списки подписей слева направо; SWD (опционально) — вертикальный ряд у дальнего торца. */
function rows(b, pins, top, bot, x0, y1, y2, silk, topOff, botOff) {
  top.forEach((n, i) => { const x = x0 + i * 2.54; pins['t:' + i] = [f2(x), y1]; b.s += pad(x, y1) + T(x, y1 + topOff, n, silk) })
  bot.forEach((n, i) => { const x = x0 + i * 2.54; pins['b:' + i] = [f2(x), y2]; b.s += pad(x, y2) + T(x, y2 - botOff, n, silk) })
}
function swdHeader(b, pins, x, cy, boxX) {
  b.s += R(boxX, cy - 5.2, 2.5, 10.4, '#17181a', { stroke: '#000', sw: 0.1 })
  ;['3.3', 'DIO', 'CLK', 'GND'].forEach((n, i) => {
    const y = cy - 3.81 + i * 2.54
    pins['swd:' + i] = [x, f2(y)]
    b.s += pad(x, y) + T(boxX - 0.5, y + 0.4, n, { s: 1, a: 'end' })
  })
}

// Blue Pill (STM32F103C8T6): 53 × 22.8 мм, USB слева, ряды выводов 17.78 мм (7 шагов), шаг 2.54
function bluePill() {
  const W = 53, H = 22.8, y1 = 2.51, y2 = y1 + 17.78
  const top = ['G', 'G', '3.3', 'R', 'B11', 'B10', 'B1', 'B0', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'C15', 'C14', 'C13', 'VB']
  const bot = ['B12', 'B13', 'B14', 'B15', 'A8', 'A9', 'A10', 'A11', 'A12', 'A15', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', '5V', 'G', '3.3']
  const pins = {}
  const b = { s: R(0, 0, W, H, '#1a5fa8', { rx: 1, stroke: '#0c3a6b', sw: 0.2 }) + R(0.35, 0.35, W - 0.7, H - 0.7, 'none', { rx: 0.8, stroke: '#2f7bc9', sw: 0.1 }) }
  rows(b, pins, top, bot, 2.37, y1, y2, { s: 1.2 }, 2.55, 1.75)
  swdHeader(b, pins, 51.65, 11.4, 50.4)
  b.s += usbMicro(-1.7, 8.6)
  b.s += btn(9.6, 14.6) + T(9.6, 11.6, 'RESET', { s: 1.05 })
  b.s += R(12.6, 7.2, 3.4, 3.3, '#2a2c30', { rx: 0.2 }) + R(12.9, 7.6, 2.8, 0.9, '#d6b43a') + R(12.9, 9, 2.8, 0.9, '#d6b43a')
  b.s += R(16.8, 7.2, 3.4, 3.3, '#2a2c30', { rx: 0.2 }) + R(17.1, 7.6, 2.8, 0.9, '#d6b43a') + R(17.1, 9, 2.8, 0.9, '#d6b43a')
  b.s += T(14.3, 12, 'BOOT0', { s: 0.95 }) + T(18.5, 12, 'BOOT1', { s: 0.95 })
  b.s += R(22, 8.2, 4.2, 3.2, '#1b1d20', { rx: 0.2 }) + R(22.6, 11.4, 3, 1.1, '#8c9199')
  b.s += qfp(31.2, 11.4, 7, 45, '')
  b.s += T(31.2, 11.7, 'STM32F103', { s: 0.95, c: '#8b9199', w: 700 })
  b.s += R(37.6, 9.4, 5.2, 4.1, 'url(#mk)', { rx: 1.9, stroke: '#5b6068', sw: 0.12 }) + T(40.2, 11.7, '8.000', { s: 0.85, c: '#2b2f36', w: 700 })
  b.s += R(44.4, 9.6, 1.5, 3.6, 'url(#mk)', { rx: 0.7, stroke: '#5b6068', sw: 0.1 })
  b.s += led(14.4, 15, '#e6454a') + T(16.4, 15.3, 'PWR', { s: 0.85, a: 'start' }) + led(46, 14.6, '#2fd05f') + T(46, 16.3, 'PC13', { s: 0.85 })
  ;[[20.6, 14.6], [22, 14.6], [31.8, 15.4], [34.6, 15.4], [41.8, 14.6], [43.4, 14.6]].forEach(([x, y]) => (b.s += smd(x, y, 1, 0.5)))
  b.s += T(27.6, 15.9, 'BLUE PILL', { s: 1.15, c: '#cfe3f7', w: 700 })
  return { svg: svgDoc(`-1.7 0 ${f2(W + 1.7)} ${H}`, b.s), x: -1.7, y: 0, w: f2(W + 1.7), h: H, pins, license: OWN_LIC }
}

// Black Pill (WeAct STM32F411CEU6 v2/v3): 52.81 × 20.78 мм, USB-C слева, ряды 17.78 мм
function blackPill() {
  const W = 52.81, H = 20.78, y1 = 1.5, y2 = y1 + 17.78
  const top = ['5V', 'G', '3.3', 'B10', 'B2', 'B1', 'B0', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'R', 'C15', 'C14', 'C13', 'VB']
  const bot = ['B12', 'B13', 'B14', 'B15', 'A8', 'A9', 'A10', 'A11', 'A12', 'A15', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', '5V', 'G', '3.3']
  const pins = {}
  const b = { s: R(0, 0, W, H, '#16181d', { rx: 1, stroke: '#000', sw: 0.2 }) + R(0.3, 0.3, W - 0.6, H - 0.6, 'none', { rx: 0.8, stroke: '#3a3f48', sw: 0.1 }) }
  rows(b, pins, top, bot, 2.27, y1, y2, { s: 1.2 }, 2.5, 1.7)
  swdHeader(b, pins, 50.85, 10.4, 49.6)
  b.s += `<g>${R(-1.3, 6.4, 8.5, 8, 'url(#mt)', { rx: 0.9, stroke: '#6b7078', sw: 0.12 })}${R(-1.3, 7.7, 6.4, 5.4, '#14161a', { rx: 1.7 })}${R(0.2, 8.5, 4.6, 0.9, '#3b3f46')}</g>`
  b.s += R(8, 6.2, 1.8, 2.6, '#22252a', { rx: 0.2 }) + R(8, 12, 1.8, 2.6, '#22252a', { rx: 0.2 })
  b.s += btn(12.2, 8.6) + T(12.2, 11.9, 'NRST', { s: 0.9 }) + btn(16.8, 8.6) + T(16.8, 11.9, 'BOOT0', { s: 0.9 }) + btn(21.4, 8.6) + T(21.4, 11.9, 'KEY', { s: 0.9 })
  b.s += qfp(27.6, 10.4, 7, 0, 'F411CEU6')
  b.s += R(35.8, 7.4, 3.2, 2.5, 'url(#mk)', { rx: 0.6, stroke: '#5b6068', sw: 0.1 }) + T(37.4, 9, '25M', { s: 0.8, c: '#2b2f36', w: 700 })
  b.s += R(41.2, 8.2, 1.4, 3.2, 'url(#mk)', { rx: 0.6, stroke: '#5b6068', sw: 0.1 })
  b.s += led(34.4, 14.6, '#e6454a') + T(34.4, 12.9, 'PWR', { s: 0.8 }) + led(38, 14.6, '#4aa3ff') + T(38, 12.9, 'C13', { s: 0.8 })
  ;[[13.8, 13.6], [15.2, 13.6], [43.4, 14.6], [44.8, 14.6]].forEach(([x, y]) => (b.s += smd(x, y, 1, 0.5)))
  return { svg: svgDoc(`-1.3 0 ${f2(W + 1.3)} ${H}`, b.s), x: -1.3, y: 0, w: f2(W + 1.3), h: H, pins, license: OWN_LIC }
}

// Nucleo-32 (NUCLEO-L432KC): 43.18 × 18.5 мм, форм-фактор Arduino Nano, USB слева, ряды 15.24 мм
function nucleo32() {
  const W = 43.18, H = 18.5, y1 = 1.63, y2 = y1 + 15.24
  const top = ['VIN', 'GND', 'RST', '5V', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'REF', '3V3', 'D13']
  const bot = ['D1', 'D0', 'RST', 'GND', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12']
  const pins = {}
  const b = { s: R(0, 0, W, H, '#eceeef', { rx: 0.9, stroke: '#9aa0a6', sw: 0.2 }) }
  rows(b, pins, top, bot, 3.81, y1, y2, { s: 1.05, c: '#12306b', w: 600 }, 2.4, 1.6)
  b.s += `<g>${R(-1.5, 5.4, 7, 7.4, 'url(#mt)', { rx: 0.3, stroke: '#6b7078', sw: 0.12 })}${R(-1.6, 6.5, 4.8, 5.2, '#14161a', { rx: 0.3 })}${R(-1.1, 7.6, 3.4, 3, '#3b3f46')}</g>`
  b.s += qfp(11.6, 9.25, 4.6, 0, 'ST-LINK')
  b.s += R(17.4, 7.4, 3.4, 2.2, 'url(#mk)', { rx: 0.5, stroke: '#5b6068', sw: 0.1 })
  b.s += qfp(30.2, 9.25, 4.8, 0, 'L432KC')
  b.s += btn(23.4, 12.2) + T(23.4, 9.7, 'RESET', { s: 0.85, c: '#12306b' })
  b.s += led(17.4, 5.8, '#2fd05f') + T(17.4, 7, 'LD3', { s: 0.75, c: '#12306b' }) + led(22.6, 5.8, '#e6454a') + T(22.6, 7, 'LD1', { s: 0.75, c: '#12306b' })
  b.s += T(37, 9, 'NUCLEO', { s: 1, c: '#12306b', w: 700 }) + T(37, 10.4, 'L432KC', { s: 1, c: '#12306b', w: 700 })
  ;[[8.2, 5.2], [8.2, 12.4], [14.8, 12.8], [26.8, 5.4], [35.6, 12.2]].forEach(([x, y]) => (b.s += smd(x, y, 1, 0.5)))
  return { svg: svgDoc(`-1.6 0 ${f2(W + 1.6)} ${H}`, b.s), x: -1.6, y: 0, w: f2(W + 1.6), h: H, pins, license: OWN_LIC }
}
out['bluepill'] = bluePill()
out['blackpill'] = blackPill()
out['nucleo32'] = nucleo32()


const head = `// СГЕНЕРИРОВАНО scripts/build-board-art.mjs — не править вручную.
// Рисунки плат: Arduino Uno / Nano / Mega / ESP32 DevKit V1 — @wokwi/elements (MIT, © Uri Shaked);
// Arduino Leonardo / Pro Mini / WeMos D1 mini / STM32 Nucleo-64 — fritzing-parts (CC BY-SA 3.0, © Fritzing);
// Raspberry Pi Pico / Pico W / Pico 2 — официальные детали Fritzing от Raspberry Pi Ltd; Blue Pill, Black Pill, Nucleo-32 — собственная отрисовка. Подробности: licenses/THIRD_PARTY.md.
/* eslint-disable */
export interface BoardArt {
  /** Готовый документ SVG (вставляется как изображение) */
  svg: string
  /** Положение и размер рисунка в координатах платы, мм (начало — левый верхний угол платы) */
  x: number
  y: number
  w: number
  h: number
  /** Выводы: имя в источнике → центр площадки, мм */
  pins: Record<string, [number, number]>
  license: string
}

export const boardArt: Record<string, BoardArt> = `
writeFileSync(join(process.cwd(), 'src/renderer/src/reference/data/boardArt.ts'), head + JSON.stringify(out, null, 1) + '\n')
for (const [id, a] of Object.entries(out)) console.log(id, a.w, a.h, Object.keys(a.pins).length, a.svg.length)
