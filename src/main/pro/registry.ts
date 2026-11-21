// Реестр провайдеров Pro-режима. По умолчанию везде заглушки (stubs.ts); этапы B, C и D заменяют их своими реализациями:
//   import { proRegistry } from './registry'
//   proRegistry.register('build', myBuildProvider)
// Регистрацию выполняют при старте main (см. registerProIpc в ipc.ts). Реестр не знает про Electron — его можно тестировать отдельно.
import type { ProviderKind, ProviderMap, ProviderStatus } from './interfaces'
import { stubBuild, stubChips, stubDebug, stubProgrammer } from './stubs'

export class ProRegistry {
  private map: ProviderMap = { build: stubBuild, programmer: stubProgrammer, debug: stubDebug, chips: stubChips }
  private listeners = new Set<() => void>()

  get<K extends ProviderKind>(kind: K): ProviderMap[K] { return this.map[kind] }

  /** Подключает реализацию; возвращает функцию «вернуть то, что было» (удобно в тестах). */
  register<K extends ProviderKind>(kind: K, provider: ProviderMap[K]): () => void {
    const prev = this.map[kind]
    this.map = { ...this.map, [kind]: provider }
    this.emit()
    return () => { if (this.map[kind] === provider) { this.map = { ...this.map, [kind]: prev }; this.emit() } }
  }

  /** Сводка для интерфейса: какие части реально работают. */
  status(): ProviderStatus {
    const k = (p: { id: string; implemented: boolean }): { id: string; implemented: boolean } => ({ id: p.id, implemented: p.implemented })
    return { build: k(this.map.build), programmer: k(this.map.programmer), debug: k(this.map.debug), chips: k(this.map.chips) }
  }

  onChange(cb: () => void): () => void { this.listeners.add(cb); return () => { this.listeners.delete(cb) } }
  private emit(): void { this.listeners.forEach((cb) => cb()) }
}

export const proRegistry = new ProRegistry()
