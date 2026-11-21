// DebugProvider: OpenOCD (GDB-сервер) + arm-none-eabi-gdb --interpreter=mi3.
import { existsSync } from 'fs'
import type { DebugProvider, DebugSession, Probe, ProjectContext, RunOptions } from '../interfaces'
import { ERR, FlashFailure } from '../openocd/logParse'
import type { OpenOcdProgrammer } from '../openocd/programmer'
import { spawnTool } from '../openocd/runner'
import { GdbDebugSession, GdbError, MiClient } from './session'

export interface LaunchOptions extends RunOptions {
  /** ELF с отладочными символами (абсолютный путь) */
  elf?: string
  speedKhz?: number
  resetMode?: 'normal' | 'under-reset'
  /** Остановиться на main после запуска (по умолчанию да) */
  stopAtMain?: boolean
}

export const NO_GDB = 'Не найден arm-none-eabi-gdb. Он входит в набор ARM GNU Toolchain (его ставит этап «Сборка») и в STM32CubeIDE; можно указать путь в Настройки → Профессиональный режим.'

export class GdbDebugProvider implements DebugProvider {
  readonly id = 'gdb-mi'
  readonly implemented = true

  private readonly programmer: OpenOcdProgrammer
  private readonly locateGdb: () => string | null

  constructor(programmer: OpenOcdProgrammer, locateGdb: () => string | null) {
    this.programmer = programmer
    this.locateGdb = locateGdb
  }

  async launch(ctx: ProjectContext, probe: Probe | null, opts: LaunchOptions = {}): Promise<DebugSession> {
    const gdb = this.locateGdb()
    if (!gdb) throw new GdbError(NO_GDB)
    if (!opts.elf || !existsSync(opts.elf)) throw new FlashFailure({ ...ERR.unknown, title: 'Нет файла для отладки', hint: 'Соберите проект в конфигурации Debug (кнопка «Собрать»): нужен .elf с отладочной информацией.' })
    const server = await this.programmer.startGdbServer(ctx, probe, opts)
    let session: GdbDebugSession | null = null
    try {
      const child = spawnTool(gdb, ['--interpreter=mi3', '--nx', '-q'])
      const mi = new MiClient(child)
      session = new GdbDebugSession(mi, ctx.root, () => server.stop())
      session.onLog((l) => opts.onLog?.(l))
      child.on('error', () => undefined)
      await mi.send('-gdb-set mi-async on')
      await mi.send('-gdb-set pagination off')
      await mi.send('-gdb-set confirm off')
      await mi.send('-gdb-set breakpoint pending on')
      // Символы из ELF: ничего не пишется в устройство
      await mi.send(`-file-symbol-file "${opts.elf.replace(/\\/g, '/')}"`)
      await mi.send(`-target-select extended-remote localhost:${server.port}`)
      // Сброс и остановка ядра (память Flash не меняется)
      await mi.send('-interpreter-exec console "monitor reset halt"')
      if (opts.stopAtMain !== false) {
        try {
          await mi.send('-break-insert -t -h main')
          await session.resume()
          await session.waitStopped(15000)
        } catch (e) {
          opts.onLog?.('Не удалось остановиться на main: ' + (e instanceof Error ? e.message : String(e)))
        }
      }
      return session
    } catch (e) {
      if (session) await session.stop().catch(() => undefined)
      else await server.stop().catch(() => undefined)
      throw e
    }
  }
}
