// Сниппеты регистрового способа: набор зависит от семейства; каждый вариант компилируется настоящим arm-none-eabi-gcc на заголовках CMSIS
// (если задана папка/файл компилятора в AVRIDE_PRO_GCC или AVRIDE_E2E_GCC и кэш CMSIS в AVRIDE_CMSIS_DIR; иначе проверка компиляцией пропускается).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expandSnippet, gpioFamilies, regSnippets } from './regSnippets'

test('regSnippets: F1 настраивает порт через CRL/CRH, остальные — через MODER', () => {
  const f1 = regSnippets('STM32F1').find((s) => s.prefix === 'gpio_out')!
  assert.match(f1.body, /CRL/)
  assert.match(f1.body, /CRH/)
  assert.match(f1.body, /RCC_APB2ENR_IOP\$\{1:C\}EN/)
  assert.ok(!/MODER/.test(f1.body))
  const f4 = regSnippets('STM32F4').find((s) => s.prefix === 'gpio_out')!
  assert.match(f4.body, /MODER/)
  assert.match(f4.body, /RCC_AHB1ENR_GPIO\$\{1:C\}EN/)
  assert.ok(!/CRL/.test(f4.body))
  assert.match(regSnippets('STM32G4').find((s) => s.prefix === 'gpio_out')!.body, /RCC_AHB2ENR_GPIO/)
})

test('regSnippets: для неизвестного семейства GPIO-сниппетов нет, общие остаются', () => {
  const x = regSnippets('STM32XX').map((s) => s.prefix)
  assert.ok(!x.some((p) => p.startsWith('gpio_')))
  assert.ok(x.includes('systick_1ms') && x.includes('nvic_enable'))
  assert.equal(regSnippets(null).length, x.length)
  assert.deepEqual(gpioFamilies().sort(), ['STM32F1', 'STM32F4', 'STM32G4'])
})

test('regSnippets: expandSnippet подставляет значения по умолчанию', () => {
  assert.equal(expandSnippet('GPIO${1:C}->ODR ^= (1u << ${2:13}u);$0'), 'GPIOC->ODR ^= (1u << 13u);')
})

// ---- настоящая компиляция ----

function gccPath(): string | null {
  for (const v of [process.env['AVRIDE_PRO_GCC'], process.env['AVRIDE_E2E_GCC']]) {
    if (!v) continue
    try {
      if (statSync(v).isFile()) return v
      for (const n of ['arm-none-eabi-gcc.exe', 'arm-none-eabi-gcc']) if (existsSync(join(v, n))) return join(v, n)
    } catch { /* нет */ }
  }
  return null
}

const CHIPS: { family: string; header: string; define: string; dev: string; core: string; arch: string[] }[] = [
  { family: 'STM32F1', header: 'stm32f1xx.h', define: 'STM32F103xB', dev: 'cmsis-device-f1@v4.3.5', core: 'cmsis_core@v5.6.0_cm3', arch: ['-mcpu=cortex-m3'] },
  { family: 'STM32F4', header: 'stm32f4xx.h', define: 'STM32F411xE', dev: 'cmsis-device-f4@v2.6.12', core: 'cmsis_core@v5.6.0_cm4', arch: ['-mcpu=cortex-m4', '-mfpu=fpv4-sp-d16', '-mfloat-abi=hard'] },
  { family: 'STM32G4', header: 'stm32g4xx.h', define: 'STM32G474xx', dev: 'cmsis-device-g4@v1.2.6', core: 'cmsis_core@v5.6.0_cm4', arch: ['-mcpu=cortex-m4', '-mfpu=fpv4-sp-d16', '-mfloat-abi=hard'] }
]

for (const c of CHIPS) {
  test(`regSnippets: все сниппеты ${c.family} компилируются настоящим gcc (порты A и C, выводы 3 и 13)`, (t) => {
    const gcc = gccPath()
    const sup = process.env['AVRIDE_CMSIS_DIR']
    if (!gcc || !sup || !existsSync(join(sup, c.dev))) { t.skip('нет компилятора или кэша CMSIS'); return }
    const dir = join(process.env['TEMP'] ?? '.', 'avride-snip-test')
    mkdirSync(dir, { recursive: true })
    for (const [port, pin] of [['C', '13'], ['A', '3']]) {
      const all = regSnippets(c.family).map((s) => ({ ...s, code: expandSnippet(s.body).replace(/GPIOC/g, 'GPIO' + port).replace(/IOPCEN|GPIOCEN/g, (m) => m.replace('C', port)).replace(/\b13\b/g, pin).replace(/13u/g, pin + 'u') }))
      const top = all.filter((s) => s.prefix === 'systick_handler')
      const inMain = all.filter((s) => s.prefix !== 'systick_handler')
      const src = `#include "${c.header}"\n#include <stdint.h>\n\n${top.map((s) => s.code).join('\n')}\n\nint main(void)\n{\n${inMain.map((s) => `    {\n${s.code}\n    }`).join('\n')}\n    for (;;) {\n    }\n}\n`
      const file = join(dir, `snip_${c.family}_${port}.c`)
      writeFileSync(file, src)
      const r: { status: number | null; stderr: string } = spawnSync(gcc, [...c.arch, '-mthumb', `-D${c.define}`, '-Wall', '-Wextra', '-Wno-unused-parameter', '-Werror', '-I' + join(sup, c.dev, 'Include'), '-I' + join(sup, c.core, 'Core', 'Include'), '-std=gnu11', '-c', file, '-o', join(dir, `snip_${c.family}_${port}.o`)], { encoding: 'utf8' })
      assert.equal(r.status, 0, `компиляция ${c.family} порт ${port}:\n${r.stderr}\n${src}`)
    }
  })
}
