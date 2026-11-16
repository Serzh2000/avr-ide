// IPC примеров. Renderer присылает только идентификаторы из ответа main: путь к папке примера известен лишь здесь.
// Оригиналы не меняются: пример копируется в папку скетчей под новым именем.
import { ipcMain } from 'electron'
import { copyFile, mkdir, readdir, rm, stat } from 'fs/promises'
import { join } from 'path'
import { guard, openRoot, parentAllowed, UserError } from '../files/ipc'
import { validateSketchName } from '../files/naming'
import { freeName, pickMainIno, projectNameFromExample, targetFileName } from './core'
import { exampleDir, previewExample, scanExamples } from './scan'

const MAX_FILES = 150
const MAX_BYTES = 8 * 1024 * 1024
const MAX_DEPTH = 4

const exists = async (p: string): Promise<boolean> => !!(await stat(p).catch(() => null))

function needDir(id: unknown): string {
  const d = exampleDir(id)
  if (!d) throw new UserError('Список примеров устарел — обновите его (кнопка обновления).')
  return d
}

async function copyTree(src: string, dst: string, depth: number, budget: { files: number; bytes: number }, rename: (name: string) => string): Promise<void> {
  await mkdir(dst)
  for (const e of await readdir(src, { withFileTypes: true })) {
    if (e.isSymbolicLink() || e.name.startsWith('.')) continue
    const from = join(src, e.name)
    if (e.isDirectory()) {
      if (depth < MAX_DEPTH) await copyTree(from, join(dst, e.name), depth + 1, budget, (n) => n)
    } else if (e.isFile()) {
      const s = await stat(from)
      if (++budget.files > MAX_FILES || (budget.bytes += s.size) > MAX_BYTES) throw new UserError('Пример слишком большой для копирования.')
      await copyFile(from, join(dst, rename(e.name)))
    }
  }
}

export function registerExamplesIpc(): void {
  ipcMain.handle('examples:list', (_e, force: unknown) => guard(() => scanExamples(force === true)))

  ipcMain.handle('examples:preview', (_e, id: unknown) => guard(() => previewExample(needDir(id))))

  /** Свободное имя проекта для примера (в папке скетчей). */
  ipcMain.handle('examples:suggest-name', (_e, id: unknown, label: unknown) =>
    guard(async () => {
      needDir(id)
      const base = parentAllowed(undefined)
      const names = new Set((await readdir(base).catch(() => [] as string[])).map((n) => n.toLowerCase()))
      return freeName(projectNameFromExample(typeof label === 'string' ? label : 'Example'), (n) => names.has(n.toLowerCase()))
    })
  )

  /** Копирует пример в Documents\Arduino\<имя> (главный .ino получает то же имя) и открывает его как проект. */
  ipcMain.handle('examples:copy', (_e, id: unknown, name: unknown) =>
    guard(async () => {
      const src = needDir(id)
      if (typeof name !== 'string') throw new UserError('Введите имя проекта.')
      const bad = validateSketchName(name)
      if (bad) throw new UserError(bad)
      const base = parentAllowed(undefined)
      const dst = join(base, name)
      await mkdir(base, { recursive: true })
      if (await exists(dst)) throw new UserError(`Папка «${name}» уже существует в «${base}». Выберите другое имя.`)
      const inos = (await readdir(src)).filter((n) => n.toLowerCase().endsWith('.ino'))
      const main = pickMainIno(src.split(/[\\/]/).pop() ?? '', inos)
      try {
        await copyTree(src, dst, 0, { files: 0, bytes: 0 }, (f) => targetFileName(f, main, name))
      } catch (e) {
        await rm(dst, { recursive: true, force: true }).catch(() => undefined)
        throw e
      }
      return openRoot(dst)
    })
  )
}
