import test from 'node:test'
import assert from 'node:assert/strict'
import { envNameFor, expandPattern, findTool, spawnSpec } from './find'
import type { FindFs } from './find'
import { digestHex, parseShaFile, pickAsset } from './openocdInstall'

const mkFs = (files: string[]): FindFs => {
  const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
  const set = new Set(files.map(norm))
  return {
    exists: (p) => set.has(norm(p)),
    list: (d) => { const base = norm(d) + '/'; return [...new Set([...set].filter((f) => f.startsWith(base)).map((f) => f.slice(base.length).split('/')[0]))] }
  }
}

test('имена переменных окружения', () => {
  assert.equal(envNameFor('openocd'), 'AVRIDE_PRO_OPENOCD')
  assert.equal(envNameFor('arm-none-eabi-gdb'), 'AVRIDE_PRO_GDB')
  assert.equal(envNameFor('arm-none-eabi-gcc'), 'AVRIDE_PRO_GCC')
})

test('порядок поиска: окружение, настройка, папка IDE, CubeIDE, PATH', () => {
  const files = [
    'C:/env/openocd.exe', 'C:/custom/openocd.exe', 'D:/ud/pro-tools/openocd/xpack-1/bin/openocd.exe',
    'C:/ST/STM32CubeIDE_1.13/STM32CubeIDE/plugins/com.st.stm32cube.ide.mcu.externaltools.openocd.win32_2.1.0/tools/bin/openocd.exe', 'C:/bin/openocd.exe'
  ]
  const base = { fs: mkFs(files), platform: 'win32' as const, userDataDir: 'D:/ud', env: { PATH: 'C:/bin', SystemDrive: 'C:' } as Record<string, string> }
  assert.equal(findTool('openocd', { ...base, env: { ...base.env, AVRIDE_PRO_OPENOCD: 'C:/env/openocd.exe' } })?.source, 'env')
  assert.equal(findTool('openocd', { ...base, custom: 'C:/custom/openocd.exe' })?.source, 'custom')
  assert.equal(findTool('openocd', base)?.source, 'ide')
  const noIde = { ...base, userDataDir: 'D:/none' }
  assert.equal(findTool('openocd', noIde)?.source, 'cubeide')
  assert.equal(findTool('openocd', { ...noIde, fs: mkFs(['C:/bin/openocd.exe']) })?.source, 'path')
  assert.equal(findTool('openocd', { ...noIde, fs: mkFs([]) }), null)
})

test('раскрытие звёздочек: новые версии первыми', () => {
  const fs = mkFs(['X:/a/v1/bin/t.exe', 'X:/a/v2/bin/t.exe'])
  assert.deepEqual(expandPattern('X:/a/*/bin', fs).map((p) => p.replace(/\\/g, '/')), ['X:/a/v2/bin', 'X:/a/v1/bin'])
})

test('.mjs-имитаторы запускаются через Node-режим Electron', () => {
  const s = spawnSpec('C:/t/fake.mjs', ['-f', 'x'], 'C:/e/electron.exe')
  assert.deepEqual([s.command, s.args, s.env['ELECTRON_RUN_AS_NODE']], ['C:/e/electron.exe', ['C:/t/fake.mjs', '-f', 'x'], '1'])
  assert.equal(spawnSpec('C:/o/openocd.exe', ['a']).command, 'C:/o/openocd.exe')
})

test('релиз xPack: выбор архива Windows и разбор контрольной суммы', () => {
  const rel = { tag_name: 'v0.12.0-7', assets: [
    { name: 'xpack-openocd-0.12.0-7-linux-x64.tar.gz', size: 1, browser_download_url: 'u1' },
    { name: 'xpack-openocd-0.12.0-7-win32-x64.zip', size: 3225998, browser_download_url: 'u2', digest: 'sha256:' + 'a'.repeat(64) },
    { name: 'xpack-openocd-0.12.0-7-win32-x64.zip.sha', size: 103, browser_download_url: 'u3' }
  ] }
  const a = pickAsset(rel, 'win32', 'x64')!
  assert.equal(a.zip.browser_download_url, 'u2')
  assert.equal(a.sha?.browser_download_url, 'u3')
  assert.equal(pickAsset(rel, 'darwin', 'arm64'), null)
  const h = 'b'.repeat(64)
  assert.equal(parseShaFile(`${h} *xpack-openocd-0.12.0-7-win32-x64.zip\n`, 'xpack-openocd-0.12.0-7-win32-x64.zip'), h)
  assert.equal(parseShaFile(`${h} *other.zip`, 'x.zip'), null)
  assert.equal(digestHex('sha256:' + 'a'.repeat(64)), 'a'.repeat(64))
  assert.equal(digestHex('md5:12'), null)
})
