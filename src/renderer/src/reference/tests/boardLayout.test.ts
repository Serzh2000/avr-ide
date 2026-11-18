// Проверка размещения деталей и надписей на 3D-моделях плат (scripts/boardart): наложений нет.
// Запускает `node scripts/boardart/build.mjs --check-only` (Blender без рендера, ≈ 30 с); без Blender тест пропускается.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'

test('модели плат: детали и надписи не накладываются (build.mjs --check-only)', { skip: !existsSync(blender), timeout: 600000 }, () => {
  const r = spawnSync(process.execPath, [resolve('scripts/boardart/build.mjs'), '--check-only'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const total = /LAYOUT-TOTAL (\d+)/.exec(r.stdout ?? '')
  assert.ok(total, 'проверка не выдала итог: ' + (r.stderr ?? '').slice(-400))
  const bad = (r.stdout ?? '').split('\n').filter((l) => /^LAYOUT \S+ [1-9]/.test(l) || /^ {4}(overlap|outside|label)/.test(l))
  assert.equal(Number(total[1]), 0, 'наложения:\n' + bad.slice(0, 30).join('\n'))
})
