// BuildProvider Pro-режима: сборка проекта arm-none-eabi-gcc встроенным планировщиком на Node (без make):
// компиляция .c/.cpp/.s → .o с зависимостями .d, инкрементальность, параллельность по числу ядер, компоновка, objcopy (.bin/.hex), размер и разбор карты.
import { availableParallelism } from 'os'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import type { BuildPlan, BuildProvider, BuildResult, Diagnostic, MapReport, ProjectContext, RunOptions, SizeReport } from '../interfaces'
import { chipRecordForProject } from '../support/support'
import { STARTUP_PLACEHOLDER } from '../project/scaffold'
import type { ProProject } from '../project/types'
import { parseDiagnostics, relativeTo } from './diagnostics'
import { envWithBin, execStream } from './exec'
import { langOf } from './flags'
import { needsCompile, needsLink, runPool } from './incremental'
import type { FsLike } from './incremental'
import { linkRegions } from './linkerGen'
import { parseMap, parseMemoryUsage, parseSizeOutput, regionUsage, toMapReport } from './mapParse'
import type { RegionUsage } from './mapParse'
import { TOOL, makePlan, outDirOf } from './plan'
import type { BuildState, FullPlan } from './plan'
import type { ToolchainInfo } from './toolchain'

/** Причина, по которой сборку нельзя начать: интерфейс по коду показывает нужную карточку (установить компилятор, скачать CMSIS…). */
export type BlockCode = 'no-toolchain' | 'no-startup' | 'no-support' | 'no-linker' | 'no-sources' | 'config'
export class BuildBlocked extends Error {
  readonly code: BlockCode
  constructor(code: BlockCode, message: string) { super(message); this.name = 'BuildBlocked'; this.code = code }
}
export const isBlocked = (e: unknown): e is BuildBlocked => e instanceof BuildBlocked

const fwd = (p: string): string => p.replace(/\\/g, '/')
const kb = (n: number): string => (n >= 1024 ? (n / 1024).toFixed(1).replace('.', ',') + ' КБ' : n + ' Б')
const secs = (ms: number): string => (ms / 1000).toFixed(1).replace('.', ',') + ' с'

const withUsed = (x: RegionUsage, used: number): RegionUsage => ({ ...x, used, pct: x.length ? Math.round((used / x.length) * 1000) / 10 : 0, overflow: used > x.length })

export interface FullReport {
  configuration: string
  at: number
  size: SizeReport
  regions: RegionUsage[]
  map: MapReport
  artifacts: { elf: string; bin?: string; hex?: string; map?: string }
}

export class ArmGccBuildProvider implements BuildProvider {
  readonly id = 'arm-none-eabi-gcc'
  readonly implemented = true
  private readonly toolchain: () => Promise<ToolchainInfo | null>
  constructor(toolchain: () => Promise<ToolchainInfo | null>) { this.toolchain = toolchain }

  // ---------- файлы ----------

  /** Исходники проекта: файлы и папки из sources (рекурсивно), только C/C++/ассемблер. */
  async walkSources(root: string, project: ProProject): Promise<string[]> {
    const out: string[] = []
    const visit = async (rel: string): Promise<void> => {
      const abs = join(root, ...rel.split('/'))
      const s = await stat(abs).catch(() => null)
      if (!s) return
      if (s.isDirectory()) {
        const names = (await readdir(abs)).sort()
        for (const n of names) { if (n.startsWith('.')) continue; await visit(rel + '/' + n) }
      } else if (langOf(rel)) out.push(rel)
    }
    for (const s of project.sources) await visit(s.replace(/\/+$/, ''))
    return out
  }

  private fsFor(root: string): FsLike {
    return {
      mtime: async (rel) => (await stat(join(root, ...rel.split('/'))).catch(() => null))?.mtimeMs ?? null,
      readText: async (rel) => readFile(join(root, ...rel.split('/')), 'utf8').catch(() => null)
    }
  }

  private async readState(root: string, outDir: string): Promise<BuildState> {
    try {
      const j = JSON.parse(await readFile(join(root, ...outDir.split('/'), '.avride-state.json'), 'utf8')) as BuildState
      return j.v === 1 && j.sigs ? j : { v: 1, sigs: {} }
    } catch { return { v: 1, sigs: {} } }
  }

  private async writeState(root: string, outDir: string, st: BuildState): Promise<void> {
    await writeFile(join(root, ...outDir.split('/'), '.avride-state.json'), JSON.stringify(st), 'utf8')
  }

  // ---------- проверка перед сборкой ----------

  /** Бросает BuildBlocked, если чего-то не хватает. Возвращает найденный компилятор. */
  async preflight(ctx: ProjectContext): Promise<ToolchainInfo> {
    const { root, project } = ctx
    if (!project.configurations[ctx.configuration]) throw new BuildBlocked('config', `В проекте нет конфигурации «${ctx.configuration}».`)
    // Сначала то, что исправляется в самом проекте, потом компилятор и файлы CMSIS
    const ex = async (rel: string): Promise<boolean> => !!(await stat(join(root, ...rel.split('/'))).catch(() => null))
    if (!(await ex(project.linkerScript))) throw new BuildBlocked('no-linker', `Нет скрипта компоновки ${project.linkerScript}. Его можно создать по карте памяти чипа.`)
    const tc = await this.toolchain()
    if (!tc) throw new BuildBlocked('no-toolchain', 'Компилятор arm-none-eabi-gcc не найден. Установите его кнопкой в IDE или укажите папку в настройках.')
    const st = join(root, ...project.startupFile.split('/'))
    const stText = await readFile(st, 'utf8').catch(() => null)
    if (stText === null || stText.includes(STARTUP_PLACEHOLDER)) {
      const known = chipRecordForProject(project)
      throw new BuildBlocked(known ? 'no-support' : 'no-startup', known
        ? `В проекте нет файлов поддержки чипа ${known.name} (startup и CMSIS). Их можно скачать из репозиториев ST.`
        : `Нет файла запуска ${project.startupFile}. Добавьте startup для вашего кристалла.`)
    }
    if ((await this.walkSources(root, project)).length === 0) throw new BuildBlocked('no-sources', 'В проекте нет исходников (.c, .cpp, .s) в папках из списка «sources».')
    return tc
  }

  // ---------- BuildProvider ----------

  private async planFor(ctx: ProjectContext, tc: ToolchainInfo | null): Promise<FullPlan> {
    const rec = chipRecordForProject(ctx.project)
    return makePlan({ ctx, sources: await this.walkSources(ctx.root, ctx.project), deviceDefine: rec?.files.define, bin: tc?.bin })
  }

  async configure(ctx: ProjectContext): Promise<BuildPlan> {
    const tc = await this.preflight(ctx)
    const p = await this.planFor(ctx, tc)
    return { outDir: p.outDir, sourceFiles: p.sourceFiles, compiler: join(tc.bin, TOOL.cc), cflags: p.cflags, ldflags: p.ldflags }
  }

  async build(ctx: ProjectContext, opts: RunOptions = {}): Promise<BuildResult> {
    const t0 = Date.now()
    const log = (s: string): void => opts.onLog?.(s)
    const tc = await this.preflight(ctx)
    const { root, project, configuration } = ctx
    const plan = await this.planFor(ctx, tc)
    const fs = this.fsFor(root)
    const rootF = fwd(root).replace(/\/+$/, '')
    const absToRel = (p: string): string | null => { const f = fwd(p); return f.toLowerCase().startsWith(rootF.toLowerCase() + '/') ? f.slice(rootF.length + 1) : null }
    const env = envWithBin(tc.bin)
    await mkdir(join(root, ...plan.outDir.split('/'), 'obj'), { recursive: true })
    const state = await this.readState(root, plan.outDir)
    log(`=== Сборка: ${project.name} [${configuration}] · ${project.target.chip} · arm-none-eabi-gcc ${tc.version} ===`)

    // что пересобирать
    const todo: typeof plan.jobs = []
    for (const j of plan.jobs) {
      const n = await needsCompile(j, state, fs, absToRel)
      if (n.need) todo.push(j)
    }
    const threads = Math.max(1, Math.min(availableParallelism(), todo.length || 1))
    log(`Файлов: ${plan.jobs.length}, к компиляции: ${todo.length}${todo.length ? `, потоков: ${threads}` : ' (всё актуально)'}`)

    let compileText = ''
    let n = 0
    const pool = await runPool(todo, threads, async (j) => {
      for (const t of ['.o', '.d']) await rm(join(root, ...(t === '.o' ? j.obj : j.dep).split('/')), { force: true })
      await mkdir(join(root, ...j.obj.split('/').slice(0, -1)), { recursive: true })
      const idx = ++n
      log(`[${idx}/${todo.length}] ${j.lang === 'asm' ? 'AS' : j.lang === 'cpp' ? 'CXX' : 'CC'} ${j.src}`)
      const r = await execStream(j.tool, j.args, { cwd: root, env, signal: opts.signal, onLine: (l) => { compileText += l + '\n'; log(l) } })
      if (r.error) { log(`Не удалось запустить ${j.tool}: ${r.error}`); compileText += `error: не удалось запустить ${j.tool}\n` }
      if (r.code === 0 && !r.cancelled) { state.sigs[j.obj] = j.sig; return true }
      delete state.sigs[j.obj]
      return false
    }, opts.signal)
    await this.writeState(root, plan.outDir, state).catch(() => undefined)

    const finish = (ok: boolean, extra: Partial<BuildResult> = {}): BuildResult => ({ ok, diagnostics: parseDiagnostics(compileText, root), durationMs: Date.now() - t0, ...extra })
    if (opts.signal?.aborted) { log('--- Отменено ---'); return finish(false, { cancelled: true }) }
    if (pool.failed > 0) {
      const d = parseDiagnostics(compileText, root)
      const errs = d.filter((x) => x.severity === 'error').length
      log(`Компиляция не удалась: ошибок ${errs}. Исправьте их и повторите.`)
      return finish(false)
    }

    // компоновка
    const link = plan.link
    let ldAll = ''
    if (await needsLink(plan, state, todo.length > 0, fs)) {
      await writeFile(join(root, ...link.rsp.split('/')), link.rspText, 'utf8')
      log(`[линковка] LD ${link.elf}`)
      let ldText = ''
      const r = await execStream(link.tool, link.args, { cwd: root, env, signal: opts.signal, onLine: (l) => { ldText += l + '\n'; log(l) } })
      if (opts.signal?.aborted) { log('--- Отменено ---'); return finish(false, { cancelled: true }) }
      if (r.code !== 0) {
        compileText += ldText
        delete state.link
        await this.writeState(root, plan.outDir, state).catch(() => undefined)
        const ov = /region `(\w+)' overflowed by (\d+) bytes/.exec(ldText)
        log(ov ? `error: область памяти ${ov[1]} переполнена на ${ov[2]} байт` : 'error: компоновка не удалась')
        compileText += ov ? `error: область памяти ${ov[1]} переполнена на ${ov[2]} байт\n` : ''
        return finish(false)
      }
      compileText += ldText
      ldAll = ldText
      state.link = link.sig
    } else log('Компоновка не нужна: ELF актуален.')

    // .bin и .hex
    const arts: FullReport['artifacts'] = { elf: link.elf, map: link.map }
    for (const [fmt, out] of [['binary', link.bin], ['ihex', link.hex]] as const) {
      const r = await execStream(join(tc.bin, TOOL.objcopy), ['-O', fmt, link.elf, out], { cwd: root, env, signal: opts.signal })
      if (r.code === 0) { if (fmt === 'binary') arts.bin = out; else arts.hex = out } else log(`Не удалось создать ${out}: ${r.stderr.trim()}`)
    }

    // размер и карта
    const totals = { flashTotal: project.target.memory.flash.size, ramTotal: project.target.memory.ram.size }
    const sz = await execStream(join(tc.bin, TOOL.size), [link.elf], { cwd: root, env })
    const size = parseSizeOutput(sz.stdout, totals)
    const mapText = await readFile(join(root, ...link.map.split('/')), 'utf8').catch(() => '')
    const reported = parseMemoryUsage(ldAll)
    const regions = regionUsage(parseMap(mapText), linkRegions(project.target.memory)).map((x) => (reported[x.name] !== undefined ? withUsed(x, reported[x.name]) : x))
    if (size) {
      log(`Размер: text ${size.textBytes} · data ${size.dataBytes} · bss ${size.bssBytes} байт`)
      const fp = Math.round((size.flashUsed / totals.flashTotal) * 1000) / 10
      const rp = Math.round((size.ramUsed / totals.ramTotal) * 1000) / 10
      log(`Flash: ${kb(size.flashUsed)} из ${kb(totals.flashTotal)} (${fp}%) · RAM: ${kb(size.ramUsed)} из ${kb(totals.ramTotal)} (${rp}%)`)
      state.last = { at: Date.now(), text: size.textBytes, data: size.dataBytes, bss: size.bssBytes, regions: regions.map((x) => ({ name: x.name, origin: x.origin, length: x.length, used: x.used })) }
    }
    await this.writeState(root, plan.outDir, state).catch(() => undefined)
    log(`Готово: ${link.elf}${arts.bin ? ', ' + arts.bin : ''}${arts.hex ? ', ' + arts.hex : ''} (за ${secs(Date.now() - t0)})`)
    return finish(true, { artifacts: { elf: link.elf, bin: arts.bin, hex: arts.hex, map: link.map } })
  }

  async clean(ctx: ProjectContext, opts: RunOptions = {}): Promise<void> {
    const dir = join(ctx.root, ...outDirOf(ctx.configuration).split('/'))
    await rm(dir, { recursive: true, force: true })
    opts.onLog?.(`Удалено: ${outDirOf(ctx.configuration)}`)
  }

  async size(ctx: ProjectContext): Promise<SizeReport> {
    const st = await this.readState(ctx.root, outDirOf(ctx.configuration))
    if (!st.last) throw new Error('Для этой конфигурации ещё нет собранного образа: нажмите «Собрать».')
    const m = ctx.project.target.memory
    const l = st.last
    return { textBytes: l.text, dataBytes: l.data, bssBytes: l.bss, flashUsed: l.text + l.data, ramUsed: l.data + l.bss, flashTotal: m.flash.size, ramTotal: m.ram.size }
  }

  async map(ctx: ProjectContext): Promise<MapReport> {
    return (await this.report(ctx)).map
  }

  /** Всё для вкладки «Размер»: итоги, использование областей, секции, самые большие символы. */
  async report(ctx: ProjectContext): Promise<FullReport> {
    const outDir = outDirOf(ctx.configuration)
    const mapRel = `${outDir}/${ctx.project.name}.map`
    const text = await readFile(join(ctx.root, ...mapRel.split('/')), 'utf8').catch(() => null)
    if (text === null) throw new Error('Для этой конфигурации ещё нет карты компоновки: нажмите «Собрать».')
    const parsed = parseMap(text)
    const regs = linkRegions(ctx.project.target.memory)
    const st = await this.readState(ctx.root, outDir)
    const size = await this.size(ctx)
    return {
      configuration: ctx.configuration, at: st.last?.at ?? 0, size,
      regions: regionUsage(parsed, regs).map((x) => { const u = st.last?.regions.find((r) => r.name === x.name)?.used; return u !== undefined ? withUsed(x, u) : x }), map: toMapReport(parsed, regs, 40),
      artifacts: { elf: `${outDir}/${ctx.project.name}.elf`, bin: `${outDir}/${ctx.project.name}.bin`, hex: `${outDir}/${ctx.project.name}.hex`, map: mapRel }
    }
  }
}

export { relativeTo }
export type { Diagnostic }
