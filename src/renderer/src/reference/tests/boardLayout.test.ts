// Проверка размещения деталей и надписей на 3D-моделях плат (scripts/boardart): наложений нет.
// Запускает `node scripts/boardart/build.mjs --check-only` (Blender без рендера, ≈ 2 мин); без Blender тест пропускается.
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
  // отчёт «минимальный зазор по плате»: у каждой платы он не меньше требуемого для своей пары
  const mg = [...(r.stdout ?? '').matchAll(/^MINGAP (\S+) ([\d.]+) \(\S+ ([\d.]+)\)/gm)]
  assert.ok(mg.length >= 80, 'отчёт о минимальных зазорах неполный: ' + mg.length)
  for (const m of mg) assert.ok(Number(m[2]) + 0.006 >= Number(m[3]), `плата ${m[1]}: минимальный зазор ${m[2]} мм меньше требуемого ${m[3]} мм`)
})

// Пороги проверщика (scripts/boardart/layout_check.py) не должны быть ослаблены: самопроверка на синтетических деталях (python без Blender).
test('проверщик размещения: пороги зазоров, выступов и отчёт о минимальном зазоре', () => {
  const r = spawnSync('python', ['-I', resolve('scripts/boardart/test_layout_check.py')], { encoding: 'utf8' })
  assert.equal(r.status, 0, (r.stdout ?? '') + (r.stderr ?? ''))
})
