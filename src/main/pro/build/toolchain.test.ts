// Тесты поиска компилятора (на подменённой файловой системе) и пакета установки.
import test from 'node:test'
import assert from 'node:assert/strict'
import { TOOLCHAIN_PKG, binFromUserPath, candidates, findToolchain, fmtSize, parseGccVersion } from './toolchain'
import type { FindDeps } from './toolchain'

/** Подменная ОС: files — существующие файлы, dirs — каталоги со списком имён. */
function deps(files: string[], dirs: Record<string, string[]>, env: Record<string, string> = {}, versions: Record<string, string | null> = {}): FindDeps {
  const lower = new Set(files.map((f) => f.toLowerCase()))
  return {
    platform: 'win32',
    env,
    exists: async (p) => lower.has(p.toLowerCase()),
    listDir: async (p) => dirs[p] ?? [],
    version: async (gcc) => (gcc in versions ? versions[gcc] : 'arm-none-eabi-gcc (Arm GNU Toolchain 14.2.Rel1 (Build arm-14.52)) 14.2.1 20241119')
  }
}

const GCC = 'arm-none-eabi-gcc.exe'

test('версия gcc из первой строки', () => {
  assert.equal(parseGccVersion('arm-none-eabi-gcc (xPack GNU Arm Embedded GCC x86_64) 14.2.1 20241119'), '14.2.1 20241119')
  assert.equal(parseGccVersion('arm-none-eabi-gcc (GNU Tools for STM32 13.3.rel1.20240926-1200) 13.3.1 20240614'), '13.3.1 20240614')
  assert.equal(parseGccVersion('что-то другое'), null)
})

test('путь пользователя: файл gcc, папка bin, корень пакета, .content/bin', async () => {
  const d = deps(['C:\\tc\\bin\\' + GCC, 'C:\\pk\\bin\\' + GCC, 'C:\\xp\\.content\\bin\\' + GCC], {})
  assert.equal(await binFromUserPath('C:\\tc\\bin\\' + GCC, d), 'C:\\tc\\bin')
  assert.equal(await binFromUserPath('C:\\tc\\bin', d), 'C:\\tc\\bin')
  assert.equal(await binFromUserPath('C:\\pk\\', d), 'C:\\pk\\bin')
  assert.equal(await binFromUserPath('C:\\xp', d), 'C:\\xp\\.content\\bin')
  assert.equal(await binFromUserPath('C:\\нет', d), null)
})

test('поиск: настройка → установленный приложением → PATH → Arm GNU → CubeIDE → xPack; новые версии первыми', async () => {
  const files = [
    'D:\\mine\\bin\\' + GCC, 'C:\\app\\pro-tools\\xpack-1\\bin\\' + GCC, 'C:\\tools\\gcc\\' + GCC,
    'C:\\Program Files (x86)\\Arm GNU Toolchain arm-none-eabi\\13.3 rel1\\bin\\' + GCC, 'C:\\Program Files (x86)\\Arm GNU Toolchain arm-none-eabi\\14.2 rel1\\bin\\' + GCC,
    'C:\\ST\\STM32CubeIDE_1.16.0\\STM32CubeIDE\\plugins\\com.st.stm32cube.ide.mcu.externaltools.gnu-tools-for-stm32.13.3.rel1.win32_1.0.0.202411081344\\tools\\bin\\' + GCC,
    'C:\\Users\\u\\AppData\\Roaming\\xPacks\\@xpack-dev-tools\\arm-none-eabi-gcc\\14.2.1-1.1\\.content\\bin\\' + GCC
  ]
  const dirs: Record<string, string[]> = {
    'C:\\app\\pro-tools': ['xpack-1'],
    'C:\\Program Files (x86)\\Arm GNU Toolchain arm-none-eabi': ['13.3 rel1', '14.2 rel1'],
    'C:\\ST': ['STM32CubeIDE_1.16.0', 'Другая папка'],
    'C:\\ST\\STM32CubeIDE_1.16.0\\STM32CubeIDE\\plugins': ['com.st.stm32cube.ide.mcu.externaltools.gnu-tools-for-stm32.13.3.rel1.win32_1.0.0.202411081344', 'org.eclipse.x'],
    'C:\\Users\\u\\AppData\\Roaming\\xPacks\\@xpack-dev-tools\\arm-none-eabi-gcc': ['14.2.1-1.1']
  }
  const env = { Path: 'C:\\tools\\gcc;C:\\Windows', ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }
  const d = deps(files, dirs, env)
  const c = await candidates(d, { settingPath: 'D:\\mine', appDir: 'C:\\app\\pro-tools' })
  assert.deepEqual(c.map((x) => x.source), ['setting', 'app', 'path', 'armgnu', 'armgnu', 'cubeide', 'xpack'])
  assert.equal(c[0].bin, 'D:\\mine\\bin')
  assert.equal(c[3].bin, 'C:\\Program Files (x86)\\Arm GNU Toolchain arm-none-eabi\\14.2 rel1\\bin', 'новая версия раньше старой')
  const f = await findToolchain(d, { appDir: 'C:\\app\\pro-tools' })
  assert.equal(f.found?.source, 'app')
  assert.equal(f.found?.version, '14.2.1 20241119')
})

test('поиск: нерабочий путь из настроек пропускается и помечается; ничего нет — null', async () => {
  const d = deps(['C:\\tc\\' + GCC, 'C:\\tc2\\' + GCC], {}, { Path: 'C:\\tc2' }, { ['C:\\tc\\' + GCC]: null })
  const bad = await findToolchain(d, { settingPath: 'C:\\tc\\' + GCC, appDir: 'C:\\app' })
  assert.equal(bad.found?.source, 'path')
  assert.equal(bad.settingBad, true)
  const none = await findToolchain(deps([], {}), { appDir: 'C:\\app' })
  assert.equal(none.found, null)
  assert.equal(none.settingBad, false)
})

test('пакет установки: источник, размер и контрольная сумма записаны', () => {
  assert.match(TOOLCHAIN_PKG.url, /^https:\/\/github\.com\/xpack-dev-tools\/arm-none-eabi-gcc-xpack\/releases\/download\/v14\.2\.1-1\.1\/.*win32-x64\.zip$/)
  assert.match(TOOLCHAIN_PKG.sha256, /^[0-9a-f]{64}$/)
  assert.equal(TOOLCHAIN_PKG.size, 323368593)
  assert.equal(fmtSize(TOOLCHAIN_PKG.size), '308 МБ')
  assert.equal(fmtSize(1.5 * 1024 ** 3), '1,5 ГБ')
})
