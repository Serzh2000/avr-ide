import test from 'node:test'
import assert from 'node:assert/strict'
import type { BuildProvider } from './interfaces'
import { ProRegistry } from './registry'
import { NotImplementedError, isNotImplemented } from './stubs'

test('по умолчанию везде заглушки: ничего не реализовано', () => {
  const r = new ProRegistry()
  assert.deepEqual(Object.values(r.status()).map((s) => s.implemented), [false, false, false, false])
})

test('заглушки бросают NotImplementedError с понятным текстом', async () => {
  const r = new ProRegistry()
  const ctx = { root: '.', configuration: 'Debug' } as never
  await assert.rejects(() => r.get('build').build(ctx), (e: unknown) => isNotImplemented(e) && /Сборка ARM-проектов ещё не реализована/.test((e as Error).message))
  await assert.rejects(() => r.get('programmer').listProbes(), /ST-Link ещё не реализована/)
  await assert.rejects(() => r.get('debug').launch(ctx, null), /Отладка ещё не реализована/)
  await assert.rejects(() => r.get('chips').getChip('x'), NotImplementedError)
})

test('register подменяет провайдер, уведомляет и откатывается', async () => {
  const r = new ProRegistry()
  let n = 0
  r.onChange(() => n++)
  const impl = { id: 'gcc', implemented: true, build: async () => ({ ok: true, diagnostics: [], durationMs: 1 }) } as unknown as BuildProvider
  const undo = r.register('build', impl)
  assert.equal(r.status().build.id, 'gcc')
  assert.equal(r.status().build.implemented, true)
  assert.equal((await r.get('build').build({} as never)).ok, true)
  undo()
  assert.equal(r.status().build.implemented, false)
  assert.equal(n, 2)
})
