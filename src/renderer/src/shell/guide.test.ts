import test from 'node:test'
import assert from 'node:assert/strict'
import { explainFailure, nextStep } from './guide'
import type { NextStepInput } from './guide'

const base: NextStepInput = { found: true, busy: false, fqbn: 'esp32:esp32:esp32', coreMissing: false, portProblem: false, result: null, errors: 0, dirty: false }
const step = (p: Partial<NextStepInput>): string | undefined => nextStep({ ...base, ...p })?.action

test('nextStep: путь новичка от платы до монитора', () => {
  assert.equal(step({ found: false }), 'cli')
  assert.equal(step({ fqbn: '' }), 'pickBoard')
  assert.equal(step({ coreMissing: true }), 'cores')
  assert.equal(step({}), 'verify')
  assert.equal(step({ result: { kind: 'compile', ok: true, cancelled: false }, portProblem: true }), 'pickPort')
  assert.equal(step({ result: { kind: 'compile', ok: true, cancelled: false } }), 'upload')
  assert.equal(step({ result: { kind: 'upload', ok: true, cancelled: false } }), 'monitor')
})

test('nextStep: ошибки, правки после сборки, занятость', () => {
  assert.equal(step({ result: { kind: 'compile', ok: false, cancelled: false }, errors: 2 }), 'problems')
  assert.equal(step({ result: { kind: 'compile', ok: false, cancelled: false }, errors: 0 }), 'output')
  assert.equal(step({ result: { kind: 'upload', ok: true, cancelled: false }, dirty: true }), 'verify')
  assert.equal(step({ result: { kind: 'compile', ok: false, cancelled: false }, dirty: true }), 'verify')
  assert.equal(nextStep({ ...base, busy: true }), null)
})

test('explainFailure: заголовок, ядро, порт, память', () => {
  assert.equal(explainFailure(['fatal error: DHT.h: No such file or directory'], '')?.action, 'libs')
  assert.match(explainFailure(['fatal error: DHT.h: No such file or directory'], '')!.text, /DHT\.h/)
  assert.equal(explainFailure([], 'Error resolving FQBN: platform not installed')?.action, 'cores')
  assert.equal(explainFailure([], 'could not open port COM3')?.action, 'pickPort')
  assert.equal(explainFailure([], 'region `iram0_0_seg\' overflowed')?.action, 'output')
  assert.equal(explainFailure(["'foo' was not declared in this scope"], '')?.action, 'libs')
  assert.equal(explainFailure(['что-то непонятное'], ''), null)
})
