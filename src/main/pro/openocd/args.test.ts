import test from 'node:test'
import assert from 'node:assert/strict'
import { baseArgs, eraseArgs, formatOf, gdbServerArgs, pickTarget, probeCheckArgs, programArgs, tclPath } from './args'
import { PRO_PRESETS, defaultProject } from '../project/presets'

const T = { target: 'target/stm32f1x.cfg' }

test('основа: интерфейс ST-Link, SWD, цель, скорость по умолчанию', () => {
  assert.deepEqual(baseArgs(T), ['-f', 'interface/stlink.cfg', '-c', 'transport select hla_swd', '-f', 'target/stm32f1x.cfg', '-c', 'adapter speed 1800'])
})

test('серийный номер, скорость, каталог скриптов и подключение при сбросе', () => {
  const a = baseArgs({ ...T, scripts: 'C:\\x\\scripts', serial: '066DFF485', speedKhz: 480, resetMode: 'under-reset' })
  assert.deepEqual(a.slice(0, 2), ['-s', 'C:/x/scripts'])
  assert.ok(a.includes('adapter serial 066DFF485'))
  assert.ok(a.includes('adapter speed 480'))
  assert.ok(a.includes('reset_config srst_only srst_nogate connect_assert_srst'))
  assert.ok(a.indexOf('adapter serial 066DFF485') < a.indexOf('target/stm32f1x.cfg'))
})

test('недопустимые значения отвергаются', () => {
  assert.throws(() => baseArgs({ ...T, serial: 'a b; exit' }), /серийный/)
  assert.throws(() => baseArgs({ ...T, speedKhz: 0 }), /Скорость/)
  assert.throws(() => tclPath('C:/a{b}.elf'), /недопустим/)
})

test('program: elf без адреса, bin с адресом, пути с пробелами', () => {
  assert.equal(programArgs({ ...T, file: 'C:\\My Proj\\build\\app.elf' }).at(-1), 'program {C:/My Proj/build/app.elf} verify reset exit')
  assert.equal(programArgs({ ...T, file: 'a.bin', address: '0x08000000', verify: false }).at(-1), 'program {a.bin} 0x08000000 reset exit')
  assert.equal(programArgs({ ...T, file: 'a.hex', reset: false }).at(-1), 'program {a.hex} verify exit')
  assert.throws(() => programArgs({ ...T, file: 'a.bin' }), /адрес/)
  assert.throws(() => programArgs({ ...T, file: 'a.txt' }), /формат/)
})

test('формат файла', () => {
  assert.deepEqual(['a.ELF', 'a.hex', 'a.bin', 'a.axf', 'a.c'].map(formatOf), ['elf', 'hex', 'bin', 'elf', null])
})

test('стирание, GDB-сервер, проверка подключения', () => {
  assert.deepEqual(eraseArgs(T).slice(-6), ['-c', 'reset halt', '-c', 'flash erase_sector 0 0 last', '-c', 'exit'])
  assert.deepEqual(gdbServerArgs(T, 50123).slice(-6), ['-c', 'gdb_port 50123', '-c', 'telnet_port disabled', '-c', 'tcl_port disabled'])
  assert.deepEqual(probeCheckArgs(T).slice(-6), ['-c', 'init', '-c', 'targets', '-c', 'exit'])
})

test('цель: из проекта, иначе из базы чипов', () => {
  const p = defaultProject('X', PRO_PRESETS.find((x) => x.chip === 'STM32F103C8T6')!)
  const q = { ...p, programmer: { ...p.programmer, openocdTarget: undefined } }
  assert.equal(pickTarget(q), 'target/stm32f1x.cfg')
  assert.equal(pickTarget({ ...q, target: { ...q.target, chip: 'STM32F411CEU6' } }), 'target/stm32f4x.cfg')
  assert.equal(pickTarget({ ...q, target: { ...q.target, chip: 'NOPE123' } }), null)
  assert.equal(pickTarget({ ...p, programmer: { ...p.programmer, openocdTarget: 'stm32g4x.cfg' } }), 'target/stm32g4x.cfg')
  assert.equal(pickTarget({ ...p, programmer: { ...p.programmer, openocdTarget: 'target/stm32l4x.cfg' } }), 'target/stm32l4x.cfg')
})
