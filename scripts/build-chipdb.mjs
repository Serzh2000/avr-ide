// Генератор базы чипов STM32 для Pro-режима: src/shared/pro/chips/*.ts
//   node scripts/build-chipdb.mjs <каталог-с-источниками>
// Каталог источников (подкаталоги, скачанные заранее, ничего в репозиторий не кладётся):
//   d-mcu/    — mcu/STM32*.xml из https://github.com/STMicroelectronics/STM32_open_pin_data (BSD-3-Clause)
//   d-gpio/   — mcu/IP/GPIO-*_Modes.xml оттуда же (номера альтернативных функций AFn)
//   d-hdr/    — Include/*.h из STMicroelectronics/cmsis-device-<серия> (Apache-2.0): адреса памяти, FPU, макросы устройств
//   d-trees/  — git-деревья cmsis-device-<серия> (<серия>.json) и modm-io/cmsis-svd-stm32 (svd.json): проверка имён startup и SVD
// Всё, чего нет в источниках, в данные не попадает; проверки (макрос есть в umbrella-заголовке, startup/SVD есть в дереве) — ошибка сборки.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: node scripts/build-chipdb.mjs <sources dir>'); process.exit(1) }
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'pro', 'chips')
const rd = (d, f) => fs.readFileSync(path.join(SRC, d, f), 'utf8')

// Что собираем. kb — размер Flash/RAM из open-pin-data (индекс варианта выбирает flashIdx).
// regions: [имя, макрос базы в заголовке CMSIS, КБ | 'macro:ИМЯ_РАЗМЕРА' | 'end:ИМЯ_КОНЦА', вид, откуда размер]
const FLASH = (kb) => ['Flash', 'FLASH_BASE', kb, 'flash', 'объём — open-pin-data, адрес — CMSIS']
const CHIPS = [
  { id: 'stm32f103c8', variant: '8', name: 'STM32F103C8T6', xml: [['STM32F103C(8-B)Tx.xml', 'LQFP48']], flashIdx: 0, hdr: 'stm32f103xb', define: 'STM32F103xB', repo: 'f1', svd: 'stm32f1/STM32F103.svd', ocd: 'stm32f1x.cfg', linker: null, ram: [['SRAM', 'SRAM_BASE', 'ram']] },
  { id: 'stm32f103rb', variant: 'B', name: 'STM32F103RBT6', xml: [['STM32F103R(8-B)Tx.xml', 'LQFP64']], flashIdx: 1, hdr: 'stm32f103xb', define: 'STM32F103xB', repo: 'f1', svd: 'stm32f1/STM32F103.svd', ocd: 'stm32f1x.cfg', linker: 'STM32F103RBTx_FLASH.ld', ram: [['SRAM', 'SRAM_BASE', 'ram']] },
  { id: 'stm32f401ce', variant: 'E', name: 'STM32F401CEU6', xml: [['STM32F401C(D-E)Ux.xml', 'UFQFPN48'], ['STM32F401C(D-E)Yx.xml', 'WLCSP49']], flashIdx: 1, hdr: 'stm32f401xe', define: 'STM32F401xE', repo: 'f4', svd: 'stm32f4/STM32F401.svd', ocd: 'stm32f4x.cfg', linker: null, ram: [['SRAM', 'SRAM1_BASE', 'ram']] },
  { id: 'stm32f401re', variant: 'E', name: 'STM32F401RET6', xml: [['STM32F401R(D-E)Tx.xml', 'LQFP64']], flashIdx: 1, hdr: 'stm32f401xe', define: 'STM32F401xE', repo: 'f4', svd: 'stm32f4/STM32F401.svd', ocd: 'stm32f4x.cfg', linker: null, ram: [['SRAM', 'SRAM1_BASE', 'ram']] },
  { id: 'stm32f411ce', variant: 'E', name: 'STM32F411CEU6', xml: [['STM32F411C(C-E)Ux.xml', 'UFQFPN48'], ['STM32F411C(C-E)Yx.xml', 'WLCSP49']], flashIdx: 1, hdr: 'stm32f411xe', define: 'STM32F411xE', repo: 'f4', svd: 'stm32f4/STM32F411.svd', ocd: 'stm32f4x.cfg', linker: null, ram: [['SRAM', 'SRAM1_BASE', 'ram']] },
  { id: 'stm32f411re', variant: 'E', name: 'STM32F411RET6', xml: [['STM32F411R(C-E)Tx.xml', 'LQFP64']], flashIdx: 1, hdr: 'stm32f411xe', define: 'STM32F411xE', repo: 'f4', svd: 'stm32f4/STM32F411.svd', ocd: 'stm32f4x.cfg', linker: null, ram: [['SRAM', 'SRAM1_BASE', 'ram']] },
  { id: 'stm32f446re', variant: 'E', name: 'STM32F446RET6', xml: [['STM32F446R(C-E)Tx.xml', 'LQFP64']], flashIdx: 1, hdr: 'stm32f446xx', define: 'STM32F446xx', repo: 'f4', svd: 'stm32f4/STM32F446.svd', ocd: 'stm32f4x.cfg', linker: 'STM32F446RETX_FLASH.ld',
    ram: [['SRAM1', 'SRAM1_BASE', 'diff:SRAM2_BASE', 'ram'], ['SRAM2', 'SRAM2_BASE', 'rest', 'ram']] },
  { id: 'stm32f407vg', variant: 'G', name: 'STM32F407VGT6', xml: [['STM32F407V(E-G)Tx.xml', 'LQFP100']], flashIdx: 1, hdr: 'stm32f407xx', define: 'STM32F407xx', repo: 'f4', svd: 'stm32f4/STM32F407.svd', ocd: 'stm32f4x.cfg', linker: null,
    ram: [['SRAM1', 'SRAM1_BASE', 'diff:SRAM2_BASE', 'ram'], ['SRAM2', 'SRAM2_BASE', 'rest', 'ram'], ['CCM', 'CCMDATARAM_BASE', 'end:CCMDATARAM_END', 'ram']] },
  { id: 'stm32f303re', variant: 'E', name: 'STM32F303RET6', xml: [['STM32F303R(D-E)Tx.xml', 'LQFP64']], flashIdx: 1, hdr: 'stm32f303xe', define: 'STM32F303xE', repo: 'f3', svd: 'stm32f3/STM32F303.svd', ocd: 'stm32f3x.cfg', linker: 'STM32F303RETx_FLASH.ld',
    ram: [['SRAM', 'SRAM_BASE', 'ram']], note: 'CCM-RAM (CCMDATARAM_BASE = 0x10000000) есть в заголовке CMSIS, но её размер в проверенных источниках не указан — область не включена' },
  { id: 'stm32g431kb', variant: 'B', name: 'STM32G431KBT6', xml: [['STM32G431K(6-8-B)Tx.xml', 'LQFP32'], ['STM32G431K(6-8-B)Ux.xml', 'UFQFPN32']], flashIdx: 2, hdr: 'stm32g431xx', define: 'STM32G431xx', repo: 'g4', svd: 'stm32g4/STM32G431.svd', ocd: 'stm32g4x.cfg', linker: 'STM32G431KBTX_FLASH.ld',
    ram: [['SRAM1', 'SRAM1_BASE', 'macro:SRAM1_SIZE_MAX', 'ram'], ['SRAM2', 'SRAM2_BASE', 'macro:SRAM2_SIZE', 'ram'], ['CCMSRAM', 'CCMSRAM_BASE', 'macro:CCMSRAM_SIZE', 'ram']] },
  { id: 'stm32g474re', variant: 'E', name: 'STM32G474RET6', xml: [['STM32G474R(B-C-E)Tx.xml', 'LQFP64']], flashIdx: 2, hdr: 'stm32g474xx', define: 'STM32G474xx', repo: 'g4', svd: 'stm32g4/STM32G474.svd', ocd: 'stm32g4x.cfg', linker: 'STM32G474RETX_FLASH.ld',
    ram: [['SRAM1', 'SRAM1_BASE', 'macro:SRAM1_SIZE_MAX', 'ram'], ['SRAM2', 'SRAM2_BASE', 'macro:SRAM2_SIZE', 'ram'], ['CCMSRAM', 'CCMSRAM_BASE', 'macro:CCMSRAM_SIZE', 'ram']] },
  { id: 'stm32l476rg', variant: 'G', name: 'STM32L476RGT6', xml: [['STM32L476R(C-E-G)Tx.xml', 'LQFP64']], flashIdx: 2, hdr: 'stm32l476xx', define: 'STM32L476xx', repo: 'l4', svd: 'stm32l4/STM32L476.svd', ocd: 'stm32l4x.cfg', linker: null,
    ram: [['SRAM1', 'SRAM1_BASE', 'macro:SRAM1_SIZE_MAX', 'ram'], ['SRAM2', 'SRAM2_BASE', 'macro:SRAM2_SIZE', 'ram']] },
  { id: 'stm32l053r8', variant: '8', name: 'STM32L053R8T6', xml: [['STM32L053R(6-8)Tx.xml', 'LQFP64']], flashIdx: 1, hdr: 'stm32l053xx', define: 'STM32L053xx', repo: 'l0', svd: 'stm32l0/STM32L053.svd', ocd: 'stm32l0.cfg', linker: null,
    ram: [['SRAM', 'SRAM_BASE', 'macro:SRAM_SIZE_MAX', 'ram']], eeprom: 'DATA_EEPROM_BASE' },
  { id: 'stm32l152re', name: 'STM32L152RET6', xml: [['STM32L152RETx.xml', 'LQFP64']], flashIdx: 0, hdr: 'stm32l152xe', define: 'STM32L152xE', repo: 'l1', svd: 'stm32l1/STM32L152.svd', ocd: 'stm32l1.cfg', linker: null,
    ram: [['SRAM', 'SRAM_BASE', 'ram']], eeprom: 'end:FLASH_EEPROM_END' },
  { id: 'stm32f030f4', name: 'STM32F030F4P6', xml: [['STM32F030F4Px.xml', 'TSSOP20']], flashIdx: 0, hdr: 'stm32f030x6', define: 'STM32F030x6', repo: 'f0', svd: 'stm32f0/STM32F0x0.svd', ocd: 'stm32f0x.cfg', linker: null, ram: [['SRAM', 'SRAM_BASE', 'ram']] },
  { id: 'stm32h743zi', name: 'STM32H743ZIT6', xml: [['STM32H743ZITx.xml', 'LQFP144']], flashIdx: 0, hdr: 'stm32h743xx', define: 'STM32H743xx', repo: 'h7', svd: 'stm32h7/STM32H743.svd', ocd: 'stm32h7x.cfg', linker: 'STM32H743ZITX_FLASH.ld',
    flashRegions: [['Flash bank 1', 'FLASH_BANK1_BASE', 1024], ['Flash bank 2', 'FLASH_BANK2_BASE', 1024]],
    ram: [['ITCM', 'D1_ITCMRAM_BASE', 64, 'ram', 'комментарий заголовка CMSIS'], ['DTCM', 'D1_DTCMRAM_BASE', 128, 'ram', 'комментарий заголовка CMSIS'], ['AXI SRAM', 'D1_AXISRAM_BASE', 512, 'ram', 'комментарий заголовка CMSIS'], ['SRAM1-3 (D2)', 'D2_AHBSRAM_BASE', 288, 'ram', 'комментарий заголовка CMSIS'], ['SRAM4 (D3)', 'D3_SRAM_BASE', 64, 'ram', 'комментарий заголовка CMSIS']],
    note: 'Сумма AXI+D2+D3 = 864 КБ и ITCM+DTCM = 192 КБ совпадает с Ram/CCMRam из open-pin-data; Backup SRAM 4 КБ (D3_BKPSRAM_BASE) не включена' }
]

const OCD_OK = new Set(['stm32f0x.cfg', 'stm32f1x.cfg', 'stm32f3x.cfg', 'stm32f4x.cfg', 'stm32g4x.cfg', 'stm32h7x.cfg', 'stm32l0.cfg', 'stm32l1.cfg', 'stm32l4x.cfg']) // HTTP 200 на raw.githubusercontent.com/openocd-org/openocd/master/tcl/target/
const MIDDLEWARE = /^(FATFS|FREERTOS|USB_DEVICE|USB_HOST|NVIC|GPIO|LWIP|MBEDTLS|SYS|RCC|CORTEX_M\d.*|TOUCHSENSING|GRAPHICS|NET|PDM2PCM)$/

const trees = {}
const tree = (n) => (trees[n] ??= JSON.parse(rd('d-trees', n + '.json')).tree.map((x) => x.path))
const svdTree = tree('svd')

const hdrMacros = (hdr) => {
  const m = {}
  for (const l of rd('d-hdr', hdr + '.h').split('\n')) {
    const x = /^\s*#define\s+(\w+)\s+(.+?)\s*(?:\/\*.*)?$/.exec(l)
    if (x && !(x[1] in m)) m[x[1]] = x[2]
  }
  const val = (n, depth = 0) => {
    let v = m[n]
    if (v === undefined || depth > 5) return undefined
    v = v.replace(/[()]/g, '').replace(/U?L?$/, '').trim()
    if (/^0x[0-9a-fA-F]+U?L?$/i.test(v)) return parseInt(v, 16)
    if (/^\w+$/.test(v)) return val(v, depth + 1)
    return undefined
  }
  return { raw: m, val }
}

const attr = (s, n) => new RegExp(`(?:^|[ \\t])${n}="([^"]*)"`).exec(s)?.[1]

function parseMcu(file) {
  const x = rd('d-mcu', file)
  const head = x.slice(0, x.indexOf('<IP '))
  const nums = (tag) => [...head.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g'))].map((m) => +m[1])
  const mcu = /<Mcu ([^>]*)>/.exec(x)[1]
  const volt = /<Voltage ([^/]*)\/>/.exec(head)[1], temp = /<Temperature ([^/]*)\/>/.exec(head)[1]
  const ips = [...x.matchAll(/<IP ([^>]*?)\/>/g)].map((m) => ({ inst: attr(m[1], 'InstanceName'), name: attr(m[1], 'Name'), ver: attr(m[1], 'Version'), cfg: attr(m[1], 'ConfigFile') }))
  const pins = []
  for (const m of x.matchAll(/<Pin Name="([^"]*)" Position="([^"]*)" Type="([^"]*)"(?:\s*\/>|>([\s\S]*?)<\/Pin>)/g)) {
    const sigs = [...(m[4] ?? '').matchAll(/<Signal ([^>]*?)\/>/g)].map((s) => attr(s[1], 'Name')).filter((s) => s && s !== 'GPIO')
    pins.push({ name: m[1], pos: m[2], type: m[3], sigs })
  }
  return {
    family: attr(mcu, 'Family'), line: attr(mcu, 'Line'), pkg: attr(mcu, 'Package'), ref: attr(mcu, 'RefName'),
    core: /<Core>([^<]*)<\/Core>/.exec(head)[1], mhz: nums('Frequency')[0], ram: nums('Ram'), ccm: nums('CCMRam'), flash: nums('Flash'), eeprom: nums('E2prom'), die: /<Die>([^<]*)</.exec(head)[1],
    volt: [+attr(volt, 'Min'), +attr(volt, 'Max')], temp: [+attr(temp, 'Min'), +attr(temp, 'Max')], ips, pins,
    gpio: ips.find((i) => i.inst === 'GPIO')?.ver
  }
}

const afCache = {}
function afTable(ver) {
  if (afCache[ver]) return afCache[ver]
  const x = rd('d-gpio', `GPIO-${ver}_Modes.xml`)
  const t = {}
  for (const b of x.split('<GPIO_Pin ').slice(1)) {
    const pn = attr(b.slice(0, b.indexOf('>')), 'Name')
    const base = /^P[A-Z]\d+/.exec(pn)?.[0]
    if (!base) continue
    const sigs = (t[base] ??= {})
    for (const s of b.split('<PinSignal ').slice(1)) {
      const sn = attr(s.slice(0, s.indexOf('>')), 'Name')
      const afs = [...s.matchAll(/GPIO_AF(\d+)_/g)].map((m) => +m[1])
      const remaps = [...s.matchAll(/__HAL_AFIO_REMAP_(\w+)/g)].map((m) => m[1])
      sigs[sn] = { af: afs.length ? afs[0] : -1, multi: new Set(afs).size > 1, remap: /DefaultRemap="true"/.test(s) ? '' : remaps.join('|') }
    }
  }
  return (afCache[ver] = t)
}

const q = (v) => JSON.stringify(v)
const issues = []

for (const cfg of CHIPS) {
  const pkgs = cfg.xml.map(([f, label]) => ({ ...parseMcu(f), file: f, label }))
  const m0 = pkgs[0]
  const fi = cfg.flashIdx
  const flashKB = m0.flash[fi]
  const ramKB = m0.ram.length === 1 ? m0.ram[0] : m0.ram[fi]
  const hm = hdrMacros(cfg.hdr)
  const core = /Cortex-M\d\+?/.exec(m0.core)[0]
  const fpu = hm.raw.__FPU_PRESENT !== undefined && /^1/.test(hm.raw.__FPU_PRESENT)

  // --- проверки имён файлов
  const umb = rd('d-hdr', `stm32${cfg.repo}xx.h`)
  if (!new RegExp(`defined\\(${cfg.define}\\)`).test(umb)) issues.push(`${cfg.id}: макрос ${cfg.define} не найден в stm32${cfg.repo}xx.h`)
  const startup = `startup_${cfg.hdr}.s`
  if (!tree(cfg.repo).some((p) => p.endsWith('gcc/' + startup))) issues.push(`${cfg.id}: ${startup} нет в дереве cmsis-device-${cfg.repo}`)
  if (!svdTree.includes(cfg.svd)) issues.push(`${cfg.id}: ${cfg.svd} нет в дереве cmsis-svd-stm32`)
  if (!OCD_OK.has(cfg.ocd)) issues.push(`${cfg.id}: openocd ${cfg.ocd} не подтверждён`)

  // --- память
  const regions = []
  const B = (name) => { const v = hm.val(name); if (v === undefined) issues.push(`${cfg.id}: нет ${name} в ${cfg.hdr}.h`); return v }
  if (cfg.flashRegions) for (const [n, mac, kb] of cfg.flashRegions) regions.push([n, B(mac), kb * 1024, 'flash', 'адрес — CMSIS, объём банка — комментарий заголовка'])
  else regions.push(['Flash', B('FLASH_BASE'), flashKB * 1024, 'flash', 'адрес — CMSIS, объём — open-pin-data'])
  let ramSum = 0
  const ramRows = cfg.ram
  for (let i = 0; i < ramRows.length; i++) {
    const [name, mac, how, kind, srcNote] = ramRows[i]
    const base = B(mac)
    let size
    if (how === 'ram') size = ramKB * 1024
    else if (typeof how === 'number') size = how * 1024
    else if (how.startsWith('macro:')) size = B(how.slice(6))
    else if (how.startsWith('end:')) size = B(how.slice(4)) - base + 1
    else if (how.startsWith('diff:')) size = B(how.slice(5)) - base
    else if (how === 'rest') size = ramKB * 1024 - ramSum
    regions.push([name, base, size, kind ?? 'ram', srcNote ?? (how === 'ram' ? 'адрес — CMSIS, объём — open-pin-data' : how.startsWith('rest') ? 'остаток общего объёма open-pin-data' : 'адрес и размер — макросы заголовка CMSIS')])
    if (!/CCM|ITCM|DTCM/.test(name)) ramSum += size
  }
  if (cfg.eeprom) { const e = m0.eeprom[0]; const eb = cfg.eeprom.startsWith('end:') ? B(cfg.eeprom.slice(4)) - e + 1 : B(cfg.eeprom); regions.push(['EEPROM', eb, e, 'other', `адрес — CMSIS (${cfg.eeprom}), объём — open-pin-data (E2prom)`]) }
  {
    const noCcm = regions.filter((r) => r[3] === 'ram' && !/CCM|ITCM|DTCM/.test(r[0])).reduce((x, r) => x + r[2], 0)
    const all = regions.filter((r) => r[3] === 'ram').reduce((x, r) => x + r[2], 0)
    if (noCcm !== ramKB * 1024 && all !== ramKB * 1024) issues.push(`${cfg.id}: сумма ОЗУ ${noCcm}/${all} не равна ${ramKB} КБ из open-pin-data`)
  }

  // --- выводы
  const packages = pkgs.map((p) => {
    if (p.core !== m0.core || p.flash.join() !== m0.flash.join()) issues.push(`${cfg.id}: корпуса ${p.file}/${m0.file} расходятся по ядру/Flash`)
    const af = afTable(p.gpio)
    const rows = p.pins.map((pin) => {
      const type = { 'I/O': 'io', Power: 'power', Reset: 'reset', Boot: 'boot', MonoIO: 'mono' }[pin.type]
      if (!type) issues.push(`${cfg.id}: тип вывода ${pin.type}`)
      let name = pin.name, alias = ''
      const port = type === 'io' ? /^P[A-Z]\d+/.exec(pin.name)?.[0] : undefined
      if (port) { name = port; alias = pin.name.slice(port.length).replace(/^-/, '') }
      const funcs = pin.sigs.map((s) => {
        const a = port ? af[port]?.[s] : undefined
        if (a?.multi) issues.push(`${cfg.id}: ${port} ${s}: несколько AF`)
        return a ? (a.remap ? [s, a.af, a.remap] : [s, a.af]) : [s, -1]
      })
      return [pin.pos, name, type, alias, funcs]
    })
    return { name: p.label, part: p.ref.replace(/\(?[0-9A-Z](?:-[0-9A-Z])+\)?/, cfg.variant ?? ''), rows }
  })

  // --- проверка уникальности
  for (const p of packages) { const pos = new Set(); for (const r of p.rows) { if (pos.has(r[0])) issues.push(`${cfg.id} ${p.name}: дубль позиции ${r[0]}`); pos.add(r[0]) } }

  // --- AF coverage: сигналы периферии без AF
  const noAf = new Set()
  for (const p of packages) for (const r of p.rows) for (const f of r[4]) if (f[1] < 0 && /^(USART|UART|LPUART|SPI|I2C|TIM|CAN|FDCAN|USB|SDIO|SDMMC|QUADSPI|FSMC|FMC|I2S|SAI|ETH|DCMI|LPTIM|OPAMP|COMP|SWPMI|DFSDM)\d?/.test(f[0]) && !f[2]) noAf.add(f[0])
  if (noAf.size) console.log(`  ${cfg.id}: сигналы без номера AF: ${[...noAf].slice(0, 14).join(' ')}${noAf.size > 14 ? ' …' : ''} (${noAf.size})`)

  const periph = [...new Set(m0.ips.filter((i) => !MIDDLEWARE.test(i.inst) && !MIDDLEWARE.test(i.name)).map((i) => i.inst))]
  const notes = []
  if (cfg.note) notes.push(cfg.note)
  if (cfg.linker === null) notes.push('Имя скрипта компоновщика в проверенных примерах STM32Cube для этого кристалла не найдено — скрипт нужно генерировать по карте памяти')
  if (/^stm32f1|^stm32l1/.test(cfg.id)) notes.push(cfg.id.startsWith('stm32f1') ? 'F1: вместо AFn используется ремап AFIO: третье поле функции — ремап из HAL (например USART1_ENABLE), при котором функция попадает на этот вывод; без третьего поля функция доступна на этом выводе без ремапа' : 'L1: AF по open-pin-data')
  notes.push(`Объём Flash/RAM — из open-pin-data для варианта «${cfg.name.replace(/[T|U|P]\d$/, '')}»; серийные кристаллы одной линейки могут отличаться объёмом`)
  notes.push(`Целевой файл OpenOCD: имя файла проверено в openocd-org/openocd; применимость к конкретному кристаллу — по таблице OpenOCD, здесь не проверялась`)

  const fileTxt = (r) => ' ' + q(r)
  const out = `// СГЕНЕРИРОВАНО scripts/build-chipdb.mjs — не править вручную.
// ${cfg.name}: выводы и сигналы — STMicroelectronics/STM32_open_pin_data (BSD-3-Clause, © STMicroelectronics); память, макрос устройства, startup — cmsis-device-${cfg.repo} (Apache-2.0).
/* eslint-disable */
import type { ChipRecord } from '../chipdb'

export const chip: ChipRecord = {
  id: ${q(cfg.id)}, name: ${q(cfg.name)}, family: ${q(m0.family)}, line: ${q(m0.line)}, core: ${q(core)}, fpu: ${fpu}, maxMHz: ${m0.mhz}, dieId: ${q(m0.die)},
  flashKB: ${flashKB}, ramKB: ${ramKB}, voltage: ${q(m0.volt)}, tempC: ${q(m0.temp)},
  regions: [
${regions.map((r) => '   ' + fileTxt(r)).join(',\n')}
  ],
  packages: [
${packages.map((p) => `    { name: ${q(p.name)}, part: ${q(p.part)}, pins: [\n${p.rows.map((r) => '     ' + q(r)).join(',\n')}\n    ] }`).join(',\n')}
  ],
  peripherals: ${q(periph)},
  files: { header: ${q(cfg.hdr + '.h')}, define: ${q(cfg.define)}, startup: ${q(startup)}, cmsisRepo: ${q('cmsis-device-' + cfg.repo)}, svd: ${q(cfg.svd)}, openocd: ${q(cfg.ocd)}, linker: ${q(cfg.linker)} },
  src: { pins: 'pins', memory: 'cmsis', files: 'cmsis', svd: 'svd', openocd: 'openocd'${cfg.linker ? ", linker: 'cube'" : ''} },
  notes: ${q(notes)}
}
`
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, cfg.id + '.ts'), out)
  console.log(`${cfg.id}: ${(out.length / 1024).toFixed(1)} КБ, корпуса ${packages.map((p) => p.name + ' ' + p.rows.length).join(', ')}, функций ${packages[0].rows.reduce((a, r) => a + r[4].length, 0)}`)
}
const idx = `// СГЕНЕРИРОВАНО scripts/build-chipdb.mjs — не править вручную.
import type { ChipRecord } from '../chipdb'
${CHIPS.map((c) => `import { chip as ${c.id} } from './${c.id}'`).join('\n')}

export const CHIPS: ChipRecord[] = [${CHIPS.map((c) => c.id).join(', ')}]
`
fs.writeFileSync(path.join(OUT, 'index.ts'), idx)
if (issues.length) { console.error('\nПРОБЛЕМЫ:\n' + issues.join('\n')); process.exitCode = 1 }
