// Инкрементальность: что нужно пересобрать (по времени изменения файлов и хэшу команды) и пул параллельных заданий.
import { parseDepFile } from './depfile'
import type { BuildState, CompileJob, FullPlan } from './plan'

export interface FsLike {
  /** Время изменения файла (мс) или null, если файла нет */
  mtime(rel: string): Promise<number | null>
  readText(rel: string): Promise<string | null>
}

/** Нужно ли перекомпилировать файл: нет объекта, поменялись ключи, исходник или любой заголовок из .d новее объекта. */
export async function needsCompile(job: CompileJob, state: BuildState, fs: FsLike, absToRel: (p: string) => string | null): Promise<{ need: boolean; why: string }> {
  const o = await fs.mtime(job.obj)
  if (o === null) return { need: true, why: 'нет объектного файла' }
  if (state.sigs[job.obj] !== job.sig) return { need: true, why: 'изменились ключи компиляции' }
  const s = await fs.mtime(job.src)
  if (s === null || s > o) return { need: true, why: 'исходник изменён' }
  const depText = await fs.readText(job.dep)
  if (depText === null) return { need: true, why: 'нет файла зависимостей' }
  for (const d of parseDepFile(depText)) {
    const rel = absToRel(d)
    const t = rel === null ? null : await fs.mtime(rel)
    // Заголовок вне проекта (библиотека компилятора) — через абсолютный путь проверяет вызывающий; пропавший заголовок = пересборка
    if (rel !== null && (t === null || t > o)) return { need: true, why: `изменён ${d.split('/').pop()}` }
  }
  return { need: false, why: '' }
}

/** Нужно ли заново связывать: нет ELF, изменилась команда, объект или скрипт компоновки новее ELF. */
export async function needsLink(plan: FullPlan, state: BuildState, rebuilt: boolean, fs: FsLike): Promise<boolean> {
  if (rebuilt) return true
  const e = await fs.mtime(plan.link.elf)
  if (e === null || state.link !== plan.link.sig) return true
  const ls = await fs.mtime(plan.linkerScript)
  if (ls === null || ls > e) return true
  for (const j of plan.jobs) {
    const t = await fs.mtime(j.obj)
    if (t === null || t > e) return true
  }
  return false
}

export interface PoolResult { ok: number; failed: number; notStarted: number }

/** Выполняет задания с ограничением параллелизма. После первой неудачи или отмены новые задания не запускаются, запущенные дорабатывают. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<boolean>, signal?: AbortSignal): Promise<PoolResult> {
  let next = 0
  let ok = 0
  let failed = 0
  const run = async (): Promise<void> => {
    for (;;) {
      if (failed > 0 || signal?.aborted) return
      const i = next++
      if (i >= items.length) return
      if (await worker(items[i], i)) ok++
      else failed++
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => run()))
  return { ok, failed, notStarted: items.length - ok - failed }
}
