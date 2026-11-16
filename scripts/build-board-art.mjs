// Генерирует src/renderer/src/reference/data/boardArt.ts — готовые векторные рисунки плат и точные координаты выводов.
//   node scripts/build-board-art.mjs <папка @wokwi/elements/dist/esm> <папка с файлами Fritzing>
// Источники и лицензии (см. licenses/THIRD_PARTY.md):
//   • @wokwi/elements 1.9.2 (MIT, © Uri Shaked) — Arduino Uno, Nano, Mega, ESP32 DevKit V1: разметка SVG и pinInfo;
//   • fritzing-parts (рисунки CC BY-SA 3.0, © Fritzing) — Arduino Leonardo, Pro Mini, WeMos D1 mini: *_breadboard.svg и .fzp.
// Координаты в итоговых данных — в миллиметрах от левого верхнего угла платы; рисунок вставляется как <image> (data URI),
// поэтому стили и идентификаторы рисунков изолированы от интерфейса.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const wokwiDir = process.argv[2]
const fzDir = process.argv[3]
if (!wokwiDir || !fzDir) throw new Error('usage: build-board-art.mjs <wokwi esm dir> <fritzing dir>')
const PX = 25.4 / 96 // мм на CSS-пиксель
const PT = 25.4 / 72 // мм на пункт (единица рисунков Fritzing)

const out = {}

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

const head = `// СГЕНЕРИРОВАНО scripts/build-board-art.mjs — не править вручную.
// Рисунки плат: Arduino Uno / Nano / Mega / ESP32 DevKit V1 — @wokwi/elements (MIT, © Uri Shaked);
// Arduino Leonardo / Pro Mini / WeMos D1 mini — fritzing-parts (CC BY-SA 3.0, © Fritzing). Подробности: licenses/THIRD_PARTY.md.
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
