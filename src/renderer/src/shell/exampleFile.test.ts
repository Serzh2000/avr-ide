import test from 'node:test'
import assert from 'node:assert/strict'
import { codeLines, isStub, pickMainFile } from './exampleFile'

const stub = '#if CORE_MOCK\n#include "completeExample.cpp"\n#endif\n'
const real = 'void setup() {\n  Serial.begin(115200);\n  pinMode(2, OUTPUT);\n}\nvoid loop() {\n  delay(10);\n}\n'

test('codeLines: комментарии и пустые строки не считаются', () => {
  assert.equal(codeLines('// a\n\n/* b\nc */\nint x;\n'), 1)
})

test('isStub: заглушка CORE_MOCK и почти пустой .ino', () => {
  assert.equal(isStub({ name: 'a.ino', content: stub }), true)
  assert.equal(isStub({ name: 'a.ino', content: 'void setup(){}\nvoid loop(){}\n' }), true)
  assert.equal(isStub({ name: 'a.ino', content: real }), false)
  assert.equal(isStub({ name: 'a.cpp', content: stub }), false)
})

test('pickMainFile: заглушка → самый содержательный .cpp, иначе .ino', () => {
  assert.equal(pickMainFile([{ name: 'a.ino', content: stub }, { name: 'a.cpp', content: real }]), 1)
  assert.equal(pickMainFile([{ name: 'a.ino', content: real }, { name: 'b.h', content: 'int x;\n' }]), 0)
  assert.equal(pickMainFile([{ name: 'a.ino', content: stub }, { name: 'x.h', content: 'int a;\n' }, { name: 'a.cpp', content: real }]), 2)
  assert.equal(pickMainFile([{ name: 'a.ino', content: stub }]), 0)
  assert.equal(pickMainFile([{ name: 'readme.txt', content: 'x' }, { name: 'a.ino', content: real }]), 1)
})
