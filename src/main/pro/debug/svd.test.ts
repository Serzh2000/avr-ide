import test from 'node:test'
import assert from 'node:assert/strict'
import { fieldValue, parseSvd, parseSvdNumber, withField } from './svd'

const SVD = `<?xml version="1.0" encoding="utf-8"?>
<!-- пример -->
<device schemaVersion="1.1"><name>STM32F103</name><size>0x20</size><access>read-write</access>
<peripherals>
 <peripheral derivedFrom="GPIOA"><name>GPIOB</name><baseAddress>0x40010C00</baseAddress></peripheral>
 <peripheral><name>GPIOA</name><description>General purpose I/O</description><groupName>GPIO</groupName><baseAddress>0x40010800</baseAddress>
  <registers>
   <register><name>CRL</name><description>Port configuration register low</description><addressOffset>0x0</addressOffset><resetValue>0x44444444</resetValue>
    <fields>
      <field><name>MODE0</name><description>Port n mode bits</description><bitOffset>0</bitOffset><bitWidth>2</bitWidth>
        <enumeratedValues><enumeratedValue><name>Input</name><value>0</value></enumeratedValue><enumeratedValue><name>Output50</name><value>3</value></enumeratedValue></enumeratedValues></field>
      <field><name>CNF0</name><bitRange>[3:2]</bitRange></field>
    </fields></register>
   <register><name>ODR</name><addressOffset>0xC</addressOffset><access>read-only</access></register>
   <register><name>BUF%s</name><addressOffset>0x20</addressOffset><dim>2</dim><dimIncrement>4</dimIncrement><dimIndex>A,B</dimIndex></register>
  </registers></peripheral>
 <peripheral><name>TIM%s</name><baseAddress>0x40000000</baseAddress><dim>2</dim><dimIncrement>0x400</dimIncrement><dimIndex>2-3</dimIndex></peripheral>
</peripherals></device>`

test('периферия, регистры, поля, перечисления', () => {
  const d = parseSvd(SVD)
  assert.equal(d.name, 'STM32F103')
  const a = d.peripherals.find((p) => p.name === 'GPIOA')!
  assert.equal(a.base, 0x40010800)
  assert.equal(a.group, 'GPIO')
  const crl = a.registers.find((r) => r.name === 'CRL')!
  assert.equal(crl.size, 32)
  assert.equal(crl.resetValue, 0x44444444)
  assert.deepEqual(crl.fields.map((f) => [f.name, f.bitOffset, f.bitWidth]), [['MODE0', 0, 2], ['CNF0', 2, 2]])
  assert.equal(crl.fields[0].enums[1].name, 'Output50')
  assert.equal(a.registers.find((r) => r.name === 'ODR')!.access, 'read-only')
})

test('derivedFrom копирует регистры и берёт свой адрес', () => {
  const b = parseSvd(SVD).peripherals.find((p) => p.name === 'GPIOB')!
  assert.equal(b.base, 0x40010c00)
  assert.ok(b.registers.some((r) => r.name === 'CRL'))
})

test('dim: массивы регистров и периферии', () => {
  const d = parseSvd(SVD)
  const a = d.peripherals.find((p) => p.name === 'GPIOA')!
  assert.deepEqual(a.registers.filter((r) => r.name.startsWith('BUF')).map((r) => [r.name, r.offset]), [['BUFA', 0x20], ['BUFB', 0x24]])
  assert.deepEqual(d.peripherals.filter((p) => p.name.startsWith('TIM')).map((p) => [p.name, p.base]), [['TIM2', 0x40000000], ['TIM3', 0x40000400]])
})

test('числа и работа с полями', () => {
  assert.equal(parseSvdNumber('0x10'), 16)
  assert.equal(parseSvdNumber('#101'), 5)
  assert.equal(parseSvdNumber('abc'), undefined)
  assert.equal(fieldValue(0x44444443, { bitOffset: 0, bitWidth: 2 }), 3)
  assert.equal(fieldValue(0xf0000000, { bitOffset: 28, bitWidth: 4 }), 15)
  assert.equal(withField(0x44444444, { bitOffset: 0, bitWidth: 2 }, 3), 0x44444447)
  assert.equal(withField(0xffffffff, { bitOffset: 31, bitWidth: 1 }, 0), 0x7fffffff)
})

test('не SVD — понятная ошибка', () => {
  assert.throws(() => parseSvd('<html></html>'), /не файл SVD/)
})
