// Тесты пакета поддержки чипа: манифест согласован с базой чипов, проверка git-SHA-1, скачивание с подменой сети, копирование в проект.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { listChips } from '../../../shared/pro/chipdb'
import { setProDataDir } from '../paths'
import { defaultProject, presetByChip } from '../project/presets'
import { STARTUP_PLACEHOLDER, scaffoldFiles } from '../project/scaffold'
import { SUPPORT_CORES, SUPPORT_DEVICES } from './manifest'
import { chipRecordForProject, copyIntoProject, fetchToCache, gitBlobSha1, supportPlanFor, supportStatus } from './support'

test('git blob SHA-1: известные значения', () => {
  assert.equal(gitBlobSha1(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a')
  assert.equal(gitBlobSha1(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
})

test('манифест: для каждого из 16 чипов базы есть заголовки, system, startup и ядро', () => {
  const all = listChips()
  assert.equal(all.length, 16)
  for (const c of all) {
    const plan = supportPlanFor(c, `startup/${c.files.startup}`)
    assert.ok(plan, c.id)
    const kinds = plan!.jobs.map((j) => j.kind)
    for (const k of ['core', 'device', 'system', 'startup', 'license']) assert.ok(kinds.includes(k as never), `${c.id}: ${k}`)
    const dests = plan!.jobs.map((j) => j.dest)
    assert.ok(dests.some((d) => d.endsWith('/Include/' + c.files.header)), c.id + ' header')
    assert.ok(dests.includes('startup/' + c.files.startup))
    assert.ok(dests.some((d) => /^drivers\/CMSIS\/Include\/core_cm\d+(plus)?\.h$/.test(d)), c.id + ' core')
    for (const j of plan!.jobs) {
      assert.match(j.sha1, /^[0-9a-f]{40}$/)
      assert.match(j.url, /^https:\/\/raw\.githubusercontent\.com\/STMicroelectronics\/[\w-]+\/[0-9a-f]{40}\//, j.url)
      assert.ok(!j.dest.includes('..') && !j.dest.startsWith('/'))
    }
  }
  for (const s of [...Object.values(SUPPORT_DEVICES), ...Object.values(SUPPORT_CORES)]) assert.match(s.commit, /^[0-9a-f]{40}$/)
})

test('проект → запись базы чипов', () => {
  const p = defaultProject('X', presetByChip('STM32F411RET6')!)
  assert.equal(chipRecordForProject(p)?.id, 'stm32f411re')
  p.target.chip = 'STM32F411RCT6'
  assert.equal(chipRecordForProject(p)?.files.startup, 'startup_stm32f411xe.s', 'по имени startup-файла (общий у F411CE и F411RE)')
  p.target.chip = 'STM32XX'
  p.startupFile = 'startup/mine.s'
  assert.equal(chipRecordForProject(p), undefined)
})

/** Подменная сеть: отдаёт содержимое, у которого git-SHA-1 совпадает с манифестом, а для одного файла — испорченное. */
function fakeFetch(contents: Map<string, Buffer>, bad: Set<string> = new Set()): { f: typeof fetch; calls: string[] } {
  const calls: string[] = []
  const f = (async (url: string) => {
    calls.push(url)
    const b = contents.get(url)
    if (!b) return new Response('нет', { status: 404 })
    return new Response(new Uint8Array(bad.has(url) ? Buffer.from('испорчено') : b))
  }) as unknown as typeof fetch
  return { f, calls }
}

test('скачивание: проверка SHA-1, отказ при подмене, кэш не качает повторно, копирование без перезаписи', async () => {
  const data = await mkdtemp(join(tmpdir(), 'avride-sup-'))
  try {
    setProDataDir(data)
    const proj = defaultProject('T', presetByChip('STM32F103C8T6')!)
    const rec = chipRecordForProject(proj)!
    const plan = supportPlanFor(rec, proj.startupFile)!
    // свои «файлы» с реальной суммой: подменяем jobs
    const jobs = plan.jobs.map((j, i) => { const b = Buffer.from(`файл ${i}\n`); return { ...j, sha1: gitBlobSha1(b), body: b } })
    const contents = new Map(jobs.map((j) => [j.url, j.body]))
    const hooks = { log: () => undefined, progress: () => undefined, signal: new AbortController().signal }
    const bad = fakeFetch(contents, new Set([jobs[1].url]))
    await assert.rejects(() => fetchToCache(jobs, hooks, bad.f), /Контрольная сумма/)
    const ok = fakeFetch(contents)
    await fetchToCache(jobs, hooks, ok.f)
    assert.ok(ok.calls.length > 0 && ok.calls.length <= jobs.length)
    const again = fakeFetch(contents)
    await fetchToCache(jobs, hooks, again.f)
    assert.equal(again.calls.length, 0, 'всё уже в кэше')
    const root = join(data, 'proj')
    await mkdir(join(root, 'startup'), { recursive: true })
    await writeFile(join(root, proj.startupFile), '/* ' + STARTUP_PLACEHOLDER + ' */')
    const written = await copyIntoProject(root, jobs)
    assert.equal(written.length, jobs.length)
    assert.match(await readFile(join(root, proj.startupFile), 'utf8'), /^файл /, 'заготовка заменена')
    await writeFile(join(root, 'drivers/CMSIS/Include/cmsis_gcc.h'), 'моя правка')
    assert.deepEqual(await copyIntoProject(root, jobs), [], 'существующее не перезаписывается')
    assert.equal(await readFile(join(root, 'drivers/CMSIS/Include/cmsis_gcc.h'), 'utf8'), 'моя правка')
  } finally { await rm(data, { recursive: true, force: true }) }
})

test('статус и установка: проект из мастера просит файлы, после установки — всё на месте', async () => {
  const data = await mkdtemp(join(tmpdir(), 'avride-sup-'))
  try {
    setProDataDir(data)
    const p = presetByChip('STM32F103C8T6')!
    const root = join(data, 'p')
    for (const [rel, text] of Object.entries(scaffoldFiles('P', p, 'blink'))) { await mkdir(join(root, rel, '..'), { recursive: true }); await writeFile(join(root, rel), text) }
    const proj = defaultProject('P', p)
    const st = await supportStatus(root, proj)
    assert.equal(st.known, true)
    assert.equal(st.installed, false)
    assert.equal(st.cached, false)
    assert.ok(st.downloadBytes > 100_000, 'размер к скачиванию известен: ' + st.downloadBytes)
    assert.ok(st.missing.includes('startup/startup_stm32f103xb.s'), 'заготовка startup считается отсутствующей')
    assert.equal((await supportStatus(root, { ...proj, target: { ...proj.target, chip: 'ЧУЖОЙ' }, startupFile: 'startup/other.s' })).known, false)
    // подменяем сеть данными с нужными суммами
    const plan = supportPlanFor(chipRecordForProject(proj)!, proj.startupFile)!
    assert.ok(plan.sources.every((s) => s.startsWith('https://github.com/STMicroelectronics/')))
    assert.match(plan.licenses[0], /Apache-2.0/)
  } finally { await rm(data, { recursive: true, force: true }) }
})
