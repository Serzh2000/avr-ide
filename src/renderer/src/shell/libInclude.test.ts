import test from 'node:test'
import assert from 'node:assert/strict'
import { hasInclude, includeLine, insertInclude } from './libInclude'

test('includeLine и hasInclude', () => {
  assert.equal(includeLine('DHT.h'), '#include <DHT.h>')
  assert.equal(hasInclude('#include <DHT.h>\nvoid setup(){}', 'DHT.h'), true)
  assert.equal(hasInclude('#include "DHT.h"', 'DHT.h'), true)
  assert.equal(hasInclude('// #include <DHT.h>', 'DHT.h'), false)
  assert.equal(hasInclude('#include <DHTX.h>', 'DHT.h'), false)
})

test('insertInclude: после последнего include, иначе после комментариев в начале', () => {
  assert.equal(insertInclude('#include <A.h>\n#include <B.h>\nvoid f(){}', 'DHT.h'), '#include <A.h>\n#include <B.h>\n#include <DHT.h>\nvoid f(){}')
  assert.equal(insertInclude('// Мигание\nvoid setup(){}', 'DHT.h'), '// Мигание\n#include <DHT.h>\n\nvoid setup(){}')
  assert.equal(insertInclude('#include <DHT.h>\nx', 'DHT.h'), '#include <DHT.h>\nx')
  assert.equal(insertInclude('a\r\nb', 'X.h'), '#include <X.h>\r\n\r\na\r\nb')
})
