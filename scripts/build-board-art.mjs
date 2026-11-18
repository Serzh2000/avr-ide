// Генерирует src/renderer/src/reference/data/boardArt.ts — готовые векторные рисунки плат и точные координаты выводов.
//   node scripts/build-board-art.mjs <папка @wokwi/elements/dist/esm> <папка с файлами Fritzing> <папка с файлами Raspberry Pi: pico.svg, picow.svg, pico2.svg>
// Источники и лицензии (см. licenses/THIRD_PARTY.md):
//   • @wokwi/elements 1.9.2 (MIT, © Uri Shaked) — Arduino Uno, Nano, Mega, ESP32 DevKit V1: разметка SVG и pinInfo;
//   • fritzing-parts (рисунки CC BY-SA 3.0, © Fritzing) — Arduino Leonardo, Pro Mini, WeMos D1 mini, STM32 Nucleo-64: *_breadboard.svg и .fzp;
//   • Raspberry Pi Ltd, официальные детали Fritzing (из даташитов Pico, Pico W, Pico 2; лицензия «Permission to use, copy, modify, and/or distribute…», ISC-подобная): breadboard-рисунки;
//   • Blue Pill, Black Pill, Nucleo-32 и платы ESP — собственные 3D-модели, рендер scripts/boardart/build.mjs (см. licenses/THIRD_PARTY.md).
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

// Blue Pill, Black Pill, Nucleo-32 и платы ESP — рендеры 3D-моделей: scripts/boardart/build.mjs (данные — boardRenders.ts, подмешиваются в конце boardArt.ts)



const head = `// СГЕНЕРИРОВАНО scripts/build-board-art.mjs — не править вручную.
// Рисунки плат: Arduino Uno / Nano / Mega / ESP32 DevKit V1 — @wokwi/elements (MIT, © Uri Shaked);
// Arduino Leonardo / Pro Mini / WeMos D1 mini / STM32 Nucleo-64 — fritzing-parts (CC BY-SA 3.0, © Fritzing);
// Raspberry Pi Pico / Pico W / Pico 2 — официальные детали Fritzing от Raspberry Pi Ltd; Blue Pill, Black Pill, Nucleo-32 и платы ESP — рендеры собственных 3D-моделей (boardRenders.ts). Подробности: licenses/THIRD_PARTY.md.
/* eslint-disable */
import { boardRenders } from './boardRenders'

export interface BoardArt {
  /** Готовый документ SVG (вставляется как изображение) */
  svg: string
  /** Растровый рисунок (data URI WebP) — вместо svg; рендер 3D-модели платы */
  img?: string
  /** Размеры самой платы (без полей рисунка), мм — если рисунок больше платы */
  bw?: number
  bh?: number
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
writeFileSync(join(process.cwd(), 'src/renderer/src/reference/data/boardArt.ts'), head + JSON.stringify(out, null, 1) + '\nObject.assign(boardArt, boardRenders)\n')
for (const [id, a] of Object.entries(out)) console.log(id, a.w, a.h, Object.keys(a.pins).length, a.svg.length)
