import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseAdditionalUrls } from './ide2'

test('блочный список с комментариями и кавычками', () => {
  const y = `board_manager:
    additional_urls:
        - https://a.io/p.json # основной
        - "https://b.io/q.json"
        - 'http://c.io/r.json'
        # - https://off.io/x.json
daemon:
    port: "50051"
`
  assert.deepEqual(parseAdditionalUrls(y), ['https://a.io/p.json', 'https://b.io/q.json', 'http://c.io/r.json'])
})

test('строчный список и пустые варианты', () => {
  assert.deepEqual(parseAdditionalUrls('board_manager:\n  additional_urls: [https://a.io/p.json, "https://b.io/q.json"]\n'), ['https://a.io/p.json', 'https://b.io/q.json'])
  assert.deepEqual(parseAdditionalUrls('board_manager:\n  additional_urls: []\n'), [])
  assert.deepEqual(parseAdditionalUrls('board_manager:\n    additional_urls:\n'), [])
  assert.deepEqual(parseAdditionalUrls(''), [])
  assert.deepEqual(parseAdditionalUrls('daemon:\n  port: 1\n'), [])
})

test('чужие секции не читаются, дубли убираются, CRLF', () => {
  const y = 'directories:\r\n  data: x\r\nboard_manager:\r\n  additional_urls:\r\n    - https://a.io/p.json\r\n    - https://a.io/p.json\r\nlibrary:\r\n  additional_urls:\r\n    - https://not.me/x.json\r\n'
  assert.deepEqual(parseAdditionalUrls(y), ['https://a.io/p.json'])
  assert.deepEqual(parseAdditionalUrls('library:\n  additional_urls:\n    - https://not.me/x.json\n'), [])
})

test('многострочный строчный список', () => {
  assert.deepEqual(parseAdditionalUrls('board_manager:\n  additional_urls: [\n    https://a.io/1.json,\n    https://b.io/2.json\n  ]\n'), ['https://a.io/1.json', 'https://b.io/2.json'])
})
