import test from 'node:test'
import assert from 'node:assert/strict'
import { frameOf, miQuote, num, parseMiLine } from './mi'
import type { MiRecord } from './mi'

const p = (l: string): MiRecord => parseMiLine(l)!

test('приглашение и пустые строки', () => {
  assert.deepEqual(p('(gdb) '), { type: 'prompt' })
  assert.equal(parseMiLine('   '), null)
})

test('результат ^done с токеном и кортежем', () => {
  const r = p('12^done,bkpt={number="1",type="hw breakpoint",addr="0x08000130",func="main",file="main.c",fullname="C:\\\\p\\\\src\\\\main.c",line="14"}')
  assert.equal(r.type, 'result')
  if (r.type !== 'result') return
  assert.equal(r.token, 12)
  assert.equal(r.cls, 'done')
  const b = r.data['bkpt'] as Record<string, string>
  assert.equal(b['number'], '1')
  assert.equal(b['fullname'], 'C:\\p\\src\\main.c')
  assert.equal(num(b['addr']), 0x08000130)
})

test('ошибка ^error', () => {
  const r = p('3^error,msg="No symbol \\"foo\\" in current context."')
  assert.equal(r.type, 'result')
  if (r.type === 'result') { assert.equal(r.cls, 'error'); assert.equal(r.data['msg'], 'No symbol "foo" in current context.') }
})

test('остановка *stopped с кадром', () => {
  const r = p('*stopped,reason="breakpoint-hit",disp="del",bkptno="1",frame={addr="0x08000130",func="main",args=[],file="main.c",fullname="/p/src/main.c",line="14"},thread-id="1",stopped-threads="all"')
  assert.equal(r.type, 'exec')
  if (r.type !== 'exec') return
  assert.equal(r.cls, 'stopped')
  const f = frameOf(r.data['frame'])
  assert.deepEqual([f.func, f.line, f.addr, f.fullname], ['main', 14, 0x08000130, '/p/src/main.c'])
})

test('список кадров: ключи frame= отбрасываются', () => {
  const r = p('^done,stack=[frame={level="0",addr="0x1",func="delay"},frame={level="1",addr="0x2",func="main"}]')
  assert.equal(r.type, 'result')
  if (r.type !== 'result') return
  const st = r.data['stack'] as unknown[]
  assert.equal(st.length, 2)
  assert.equal(frameOf(st[1] as never).func, 'main')
})

test('списки строк и пустые значения', () => {
  const r = p('^done,register-names=["r0","r1","","sp"],asm_insns=[]')
  if (r.type !== 'result') throw new Error('нет результата')
  assert.deepEqual(r.data['register-names'], ['r0', 'r1', '', 'sp'])
  assert.deepEqual(r.data['asm_insns'], [])
})

test('поток консоли, экранирование и восьмеричные коды UTF-8', () => {
  assert.deepEqual(p('~"Reading symbols\\n"'), { type: 'console', text: 'Reading symbols\n' })
  assert.deepEqual(p('~"\\320\\237\\321\\200"'), { type: 'console', text: 'Пр' })
  assert.deepEqual(p('&"set confirm off\\n"'), { type: 'log', text: 'set confirm off\n' })
})

test('асинхронные уведомления', () => {
  assert.equal(p('=thread-group-started,id="i1",pid="42000"').type, 'notify')
  const run = p('*running,thread-id="all"')
  assert.equal(run.type === 'exec' && run.cls, 'running')
})

test('повтор ключа в кортеже собирается в массив', () => {
  const r = p('^done,x={a="1",a="2"}')
  if (r.type === 'result') assert.deepEqual((r.data['x'] as Record<string, unknown>)['a'], ['1', '2'])
})

test('битая строка бросает понятную ошибку', () => {
  assert.throws(() => parseMiLine('garbage'), /непонятная/)
  assert.throws(() => parseMiLine('^done,x={a='), /MI/)
})

test('miQuote экранирует кавычки и косую', () => {
  assert.equal(miQuote('a"b\\c'), '"a\\"b\\\\c"')
})
