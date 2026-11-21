// Сборка настоящим компилятором проектов, в которые сгенерирован код из avride.pins.json (F103C8, F411RE, G474RE).
// Нужен компилятор: AVRIDE_E2E_GCC (или AVRIDE_PRO_GCC) = папка bin arm-none-eabi-gcc; файлы CMSIS берутся из кэша AVRIDE_PRO_DIR (скачиваются по манифесту, если их там нет).
// Без компилятора тест пропускается. Проверяется: сборка без предупреждений в сгенерированных файлах (-Wall -Wextra), main.c с board_init(), повторная генерация не меняет файлы.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { getChip } from '../../../shared/pro/chipdb'
import { autoClock } from '../../../shared/pro/pinconfig/clock'
import { enablePeripheral, setClock, setGpioRole } from '../../../shared/pro/pinconfig/ops'
import { defaultPinsConfig, serializePins } from '../../../shared/pro/pinconfig/schema'
import { planGeneration, planMainInsert } from '../../../shared/pro/pinconfig/gen/index'
import type { PinsConfig } from '../../../shared/pro/pinconfig/types'
import { ArmGccBuildProvider } from '../build/provider'
import { presetByChip } from '../project/presets'
import { scaffoldFiles } from '../project/scaffold'
import { parseProjectText } from '../project/serialize'
import { setProDataDir } from '../paths'
import { installSupport } from '../support/support'

const GCC = process.env['AVRIDE_E2E_GCC'] || process.env['AVRIDE_PRO_GCC']
const skip = !GCC || !existsSync(GCC) ? 'нет AVRIDE_E2E_GCC (папка bin компилятора)' : false
if (process.env['AVRIDE_PRO_DIR']) setProDataDir(process.env['AVRIDE_PRO_DIR'])

function pinsFor(id: string, hse: number | null, target: number | null): PinsConfig {
  const chip = getChip(id)!
  let c = defaultPinsConfig(id)
  if (id === 'stm32f103c8') { c = setGpioRole(c, 'PC13', 'output', { label: 'LED', initial: 'high' }); c = enablePeripheral(c, chip, 'USART1') }
  else { c = setGpioRole(c, 'PA5', 'output', { label: 'LED' }); c = setGpioRole(c, 'PC13', 'input', { label: 'BTN' }); c = enablePeripheral(c, chip, 'USART2') }
  if (target) {
    c = setClock(c, hse ? { pllSource: 'hse', hseHz: hse } : { pllSource: 'hsi' })
    const a = autoClock(chip, c.clock, target)
    assert.ok(a?.exact, `${id}: точное решение PLL для ${target}`)
    c = setClock(c, a.cfg)
  }
  return c
}

// Режим HAL: папка AVRIDE_HAL_DIR с подпапками f1, f4, g4 (в каждой Inc и Src — драйвер HAL ST, скачанный отдельно). Без неё HAL-случаи пропускаются.
const HAL = process.env['AVRIDE_HAL_DIR']
const FAM: Record<string, string> = { stm32f103c8: 'f1', stm32f411re: 'f4', stm32g474re: 'g4' }

/** Кладёт HAL в проект (drivers/…_HAL_Driver), создаёт hal_conf из шаблона (HSE_VALUE = 8 МГц, нужные модули), добавляет пути и макрос USE_HAL_DRIVER. */
async function addHal(root: string, project: { sources: string[]; includes: string[]; defines: string[] }, fam: string): Promise<void> {
  const dir = `drivers/STM32${fam.toUpperCase()}xx_HAL_Driver`
  for (const sub of ['Inc', 'Inc/Legacy', 'Src']) {
    for (const n of await readdir(join(HAL!, fam, sub), { withFileTypes: true })) {
      if (!n.isFile() || n.name.includes('_conf_template')) continue
      await put(root, `${dir}/${sub}/${n.name}`, await readFile(join(HAL!, fam, sub, n.name), 'utf8'))
    }
  }
  let conf = await readFile(join(HAL!, fam, 'Inc', `stm32${fam}xx_hal_conf_template.h`), 'utf8')
  conf = conf.replace(/#define\s+HSE_VALUE\s+\d+U/, '#define HSE_VALUE    8000000U')
  const need = new Set(['CORTEX', 'DMA', 'EXTI', 'FLASH', 'GPIO', 'PWR', 'RCC', 'UART'])
  conf = conf.replace(/(?:\/\*\s*)?#define\s+HAL_([A-Z0-9_]+)_MODULE_ENABLED.*/g, (_m, n: string) => (need.has(n) ? `#define HAL_${n}_MODULE_ENABLED` : `/* #define HAL_${n}_MODULE_ENABLED */`))
  await put(root, `include/stm32${fam}xx_hal_conf.h`, conf)
  project.sources.push(`${dir}/Src`)
  project.includes.push(`${dir}/Inc`)
  project.defines.push('USE_HAL_DRIVER')
}

const CASES: { id: string; chip: string; name: string; hse: number | null; target: number | null; title: string; hal?: boolean }[] = [
  { id: 'stm32f103c8', chip: 'STM32F103C8T6', name: 'PinsF103', hse: 8e6, target: 72e6, title: 'F103C8: LED PC13, USART1, HSE 8 МГц → PLL 72 МГц' },
  { id: 'stm32f103c8', chip: 'STM32F103C8T6', name: 'PinsF103hsi', hse: null, target: null, title: 'F103C8: тактирование по умолчанию (HSI)' },
  { id: 'stm32f411re', chip: 'STM32F411RET6', name: 'PinsF411', hse: 8e6, target: 100e6, title: 'F411RE: LED PA5, USART2 на VCP, HSE 8 МГц → 100 МГц' },
  { id: 'stm32f411re', chip: 'STM32F411RET6', name: 'PinsF411hsi', hse: null, target: null, title: 'F411RE: тактирование по умолчанию (HSI)' },
  { id: 'stm32g474re', chip: 'STM32G474RET6', name: 'PinsG474', hse: null, target: 170e6, title: 'G474RE: LED PA5, USART2 на VCP, HSI → PLL 170 МГц' },
  { id: 'stm32g474re', chip: 'STM32G474RET6', name: 'PinsG474hsi', hse: null, target: null, title: 'G474RE: тактирование по умолчанию (HSI)' },
  { id: 'stm32f103c8', chip: 'STM32F103C8T6', name: 'HalF103', hse: 8e6, target: 72e6, hal: true, title: 'HAL, F103C8: LED PC13, USART1, HSE 8 МГц → 72 МГц' },
  { id: 'stm32f411re', chip: 'STM32F411RET6', name: 'HalF411', hse: 8e6, target: 100e6, hal: true, title: 'HAL, F411RE: LED PA5, USART2, HSE 8 МГц → 100 МГц' },
  { id: 'stm32g474re', chip: 'STM32G474RET6', name: 'HalG474', hse: null, target: 170e6, hal: true, title: 'HAL, G474RE: LED PA5, USART2, HSI → 170 МГц' }
]

const put = async (root: string, rel: string, text: string): Promise<void> => {
  const abs = join(root, ...rel.split('/'))
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, text, 'utf8')
}

for (const k of CASES) {
  test(`сборка с сгенерированным кодом — ${k.title}`, { skip: skip || (k.hal && !HAL ? 'нет AVRIDE_HAL_DIR (драйверы HAL)' : false), timeout: 300000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'avride-pins-'))
    const preset = presetByChip(k.chip)!
    for (const [rel, text] of Object.entries(scaffoldFiles(k.name, preset, 'blink'))) await put(root, rel, text)
    const pr = parseProjectText(await readFile(join(root, 'avride.project.json'), 'utf8'))
    assert.ok(pr.ok)
    if (!pr.ok) return
    const project = pr.project
    project.configurations.Debug.extraFlags = ['-Wextra']
    await installSupport(root, project, { log: () => undefined, progress: () => undefined, signal: new AbortController().signal })

    if (k.hal) await addHal(root, project, FAM[k.id])
    const cfg = { ...pinsFor(k.id, k.hse, k.target), mode: k.hal ? ('hal' as const) : ('cmsis' as const) }
    await put(root, 'avride.pins.json', serializePins(cfg))
    const plan = planGeneration(cfg, {}, { srcDir: 'src', incDir: 'include' }, !!k.hal)
    assert.ok(plan.ok, plan.blocked ?? '')
    for (const f of plan.files) await put(root, f.path, f.content)
    // main.c: вызов board_init() и использование сгенерированных светодиода и USART
    const main0 = await readFile(join(root, 'src', 'main.c'), 'utf8')
    const ins = planMainInsert(main0)
    assert.ok(ins.changed)
    const uart = k.id === 'stm32f103c8' ? 'usart1' : 'usart2'
    const mainText = ins.code.replace(/for \(;;\) \{[\s\S]*\}\s*\}\s*$/, `for (;;) {\n        LED_TOGGLE();\n        board_delay_ms(250u);\n        ${uart}_write("ping\\r\\n");\n    }\n}\n`)
    assert.match(mainText, /board_init\(\);/)
    assert.match(mainText, /_write\("ping/)
    await put(root, 'src/main.c', mainText)

    const provider = new ArmGccBuildProvider(async () => ({ bin: GCC!, version: 'test', source: 'setting' }))
    const logs: string[] = []
    const res = await provider.build({ root, project, configuration: 'Debug' }, { onLog: (l) => logs.push(l) })
    assert.ok(res.ok, `сборка не удалась:\n${logs.join('')}\n${JSON.stringify(res.diagnostics, null, 1)}`)
    const mine = res.diagnostics.filter((d) => /(^|\/)(board|clock|gpio|uart)\.[ch]$/.test(d.file ?? ''))
    assert.deepEqual(mine, [], 'в сгенерированных файлах нет предупреждений и ошибок (-Wall -Wextra)')
    assert.ok(res.artifacts?.elf)

    // повторная генерация: ничего не меняется
    const disk = Object.fromEntries(await Promise.all(plan.files.map(async (f) => [f.path, await readFile(join(root, ...f.path.split('/')), 'utf8')] as const)))
    const again = planGeneration(cfg, disk, { srcDir: 'src', incDir: 'include' }, !!k.hal)
    assert.ok(again.files.every((f) => f.status === 'same'))
  })
}
