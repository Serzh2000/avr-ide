import test from 'node:test'
import assert from 'node:assert/strict'
import { proNextStep } from './proGuide'
import type { ProNextInput } from './proGuide'

const base: ProNextInput = { hasProject: true, openocd: true, probesLoaded: true, probeCount: 1, driverMissing: false, hasElf: true, flashed: false, flashBusy: false, debug: 'off' }
const t = (o: Partial<ProNextInput>): string | undefined => proNextStep({ ...base, ...o })?.text

test('нет проекта — подсказки нет', () => assert.equal(proNextStep({ ...base, hasProject: false }), null))

test('путь новичка: OpenOCD → ST-Link → драйвер → сборка → прошивка → отладка', () => {
  assert.equal(t({ openocd: false }), 'Установите OpenOCD')
  assert.equal(t({ probeCount: 0 }), 'Подключите ST-Link')
  assert.equal(t({ driverMissing: true }), 'Установите драйвер ST-Link')
  assert.equal(t({ hasElf: false }), 'Соберите проект')
  assert.equal(t({}), 'Прошейте плату')
  assert.equal(t({ flashed: true }), 'Начните отладку')
})

test('пока ST-Link не проверен, «подключите» не показываем', () => assert.equal(t({ probeCount: 0, probesLoaded: false }), 'Прошейте плату'))

test('во время работы и отладки', () => {
  assert.match(t({ flashBusy: true }) ?? '', /Идёт работа/)
  assert.match(t({ debug: 'stopped' }) ?? '', /F10/)
  assert.match(t({ debug: 'running' }) ?? '', /выполняется/)
})
