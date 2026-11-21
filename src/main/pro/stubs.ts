// Заглушки провайдеров: каждая операция бросает NotImplementedError с понятным текстом.
import type { BuildProvider, ChipDatabase, DebugProvider, ProgrammerProvider, ProviderKind } from './interfaces'

const STAGE: Record<ProviderKind, string> = {
  build: 'Сборка ARM-проектов ещё не реализована.',
  programmer: 'Прошивка через ST-Link ещё не реализована.',
  debug: 'Отладка ещё не реализована.',
  chips: 'База кристаллов ещё не подключена: справочник STM32 пока берётся из раздела «Справочник».'
}

export class NotImplementedError extends Error {
  readonly code = 'not-implemented'
  readonly kind: ProviderKind
  constructor(kind: ProviderKind, what: string) {
    super(`${STAGE[kind]} (${what})`)
    this.name = 'NotImplementedError'
    this.kind = kind
  }
}

export const isNotImplemented = (e: unknown): e is NotImplementedError => e instanceof Error && (e as { code?: string }).code === 'not-implemented'

const nope = (kind: ProviderKind, what: string) => (): never => { throw new NotImplementedError(kind, what) }

export const stubBuild: BuildProvider = {
  id: 'stub', implemented: false,
  configure: async () => nope('build', 'configure')(),
  build: async () => nope('build', 'build')(),
  clean: async () => nope('build', 'clean')(),
  size: async () => nope('build', 'size')(),
  map: async () => nope('build', 'map')()
}

export const stubProgrammer: ProgrammerProvider = {
  id: 'stub', implemented: false,
  listProbes: async () => nope('programmer', 'listProbes')(),
  flash: async () => nope('programmer', 'flash')(),
  erase: async () => nope('programmer', 'erase')(),
  startGdbServer: async () => nope('programmer', 'startGdbServer')()
}

export const stubDebug: DebugProvider = {
  id: 'stub', implemented: false,
  launch: async () => nope('debug', 'launch')()
}

export const stubChips: ChipDatabase = {
  id: 'stub', implemented: false,
  getChip: async () => nope('chips', 'getChip')(),
  listChips: async () => nope('chips', 'listChips')(),
  pinFunctions: async () => nope('chips', 'pinFunctions')(),
  memoryMap: async () => nope('chips', 'memoryMap')()
}
