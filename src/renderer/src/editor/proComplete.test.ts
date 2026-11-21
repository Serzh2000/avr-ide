import test from 'node:test'
import assert from 'node:assert/strict'
import { proCandidates } from './proComplete'

test('proCandidates: C-ключевые слова, типы stdint и сниппеты; Arduino-функций нет', () => {
  const labels = proCandidates([]).map((c) => c.label)
  for (const l of ['for', 'while', 'struct', 'uint32_t', 'main']) assert.ok(labels.includes(l), l)
  for (const l of ['digitalWrite', 'pinMode', 'Serial', 'delay']) assert.ok(!labels.includes(l), l)
})

test('proCandidates: символы файла идут первыми и не дублируются', () => {
  const r = proCandidates([{ name: 'GPIOA_clock_enable', kind: 'function', line: 3, detail: 'void GPIOA_clock_enable(void)' }, { name: 'GPIOA_clock_enable', kind: 'function', line: 9, detail: '' }])
  assert.equal(r.filter((c) => c.label === 'GPIOA_clock_enable').length, 1)
  assert.equal(r.sort((a, b) => a.rank - b.rank)[0].label, 'GPIOA_clock_enable')
})
