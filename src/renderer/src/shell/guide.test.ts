import test from 'node:test'
import assert from 'node:assert/strict'
import { currentBuildResult, explainFailure, nextStep, uploadPortIssue } from './guide'
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
  assert.equal(nextStep({ ...base, busy: true, busyKind: 'compile' })?.text, 'Идёт сборка…')
})

test('загрузка: обязательный порт, отключённый порт и несовпадение найденной платы', () => {
  const ports = [{ address: 'COM3', label: 'COM3', protocol: 'serial', boards: [{ name: 'Uno', fqbn: 'arduino:avr:uno' }] }]
  assert.equal(uploadPortIssue('arduino:avr:uno', 'required', '', ports), 'missing')
  assert.equal(uploadPortIssue('arduino:avr:uno', 'required', 'com3', ports), null)
  assert.equal(uploadPortIssue('arduino:avr:nano', 'required', 'COM3', ports), 'mismatch')
  assert.equal(uploadPortIssue('esp32:esp32:esp32', 'required', 'COM4', ports), 'disconnected')
  assert.equal(uploadPortIssue('rp2040:rp2040:rpipico2w', 'optional', '', ports), null)
  assert.equal(uploadPortIssue('rp2040:rp2040:rpipico2w', 'optional', 'COM4', ports), 'disconnected')
  assert.equal(uploadPortIssue('STMicroelectronics:stm32:GenF1', 'none', 'COM4', ports), null)
})

test('результат сборки относится к снимку исходников и всем параметрам платы', () => {
  const root = 'C:/Sketch'
  const fqbn = 'arduino:avr:nano:cpu=atmega328'
  const result = { source: { root, fqbn, revision: 7, port: null } }
  assert.equal(currentBuildResult(result, root, fqbn, 7), result)
  assert.equal(currentBuildResult(result, root, fqbn, 8), null)
  assert.equal(currentBuildResult(result, root, 'arduino:avr:nano:cpu=atmega328old', 7), null)
  assert.equal(currentBuildResult(result, 'C:/Other', fqbn, 7), null)
})

test('nextStep: Pico в BOOTSEL загружается без COM; монитор ждёт порт после загрузки', () => {
  const compiled = { kind: 'compile' as const, ok: true, cancelled: false }
  assert.match(nextStep({ ...base, result: compiled, bootsel: true })?.text ?? '', /BOOTSEL/)
  assert.equal(step({ result: { ...compiled, kind: 'upload' }, monitorReady: false }), 'pickPort')
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
