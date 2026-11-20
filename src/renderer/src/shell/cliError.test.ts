import test from 'node:test'
import assert from 'node:assert/strict'
import { friendlyCliError, plainCliError } from './cliError'

test('plainCliError: достаёт error из JSON', () => {
  assert.equal(plainCliError('{"error": "что-то сломалось"}'), 'что-то сломалось')
  assert.equal(plainCliError('обычный текст'), 'обычный текст')
  assert.equal(plainCliError('{не json'), '{не json')
})

test('friendlyCliError: сетевые ошибки объясняются, остальное — без обёртки', () => {
  const net = friendlyCliError('{"error": "Ошибка скачивания индекса: Download failed: proxyconnect tcp: dial tcp 127.0.0.1:1"}')
  assert.match(net.text, /Нет связи с интернетом/)
  assert.match(net.details, /proxyconnect/)
  assert.equal(friendlyCliError('Библиотека не найдена').text, 'Библиотека не найдена')
})
