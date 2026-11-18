// Один запуск: рендер всех плат в Blender -> WebP с тенью -> src/renderer/src/reference/data/boardRenders.ts
//   node scripts/boardart/build.mjs [--blender <путь к blender.exe>] [--samples 160] [--keep <папка для png/webp>] [id платы ...]
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const a = process.argv.slice(2)
const flag = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d }
const ids = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--')))
const blender = flag('--blender', 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe')
const keep = flag('--keep', '')
const work = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'boardart-'))
mkdirSync(work, { recursive: true })
if (!ids.length && existsSync(join(work, 'meta.json'))) rmSync(join(work, 'meta.json'))
const env = { ...process.env, BOARDART_SAMPLES: flag('--samples', '160') }
let r = spawnSync(blender, ['-b', '--python', join(here, 'render.py'), '--', work, ...ids], { stdio: 'inherit', env })
if (r.status !== 0) process.exit(r.status ?? 1)
r = spawnSync('python', ['-I', join(here, 'convert.py'), work, join(root, 'src/renderer/src/reference/data/boardRenders.ts'), join(work, 'webp')], { stdio: 'inherit' })
process.exit(r.status ?? 0)
