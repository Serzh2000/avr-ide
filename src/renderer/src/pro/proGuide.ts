// «Дальше» для Pro-режима: следующий разумный шаг от подключения ST-Link до отладки. Чистая функция (тест — proGuide.test.ts).
export type ProGuideAction = 'hw' | 'build' | 'flash' | 'debug' | 'debugHelp'

export interface ProNextInput {
  hasProject: boolean
  /** OpenOCD найден; null — ещё не проверяли */
  openocd: boolean | null
  probesLoaded: boolean
  probeCount: number
  driverMissing: boolean
  /** Есть собранный .elf выбранной конфигурации */
  hasElf: boolean
  flashed: boolean
  flashBusy: boolean
  debug: 'off' | 'starting' | 'running' | 'stopped'
}

export interface ProNextStep { action: ProGuideAction; text: string; title: string }

export function proNextStep(s: ProNextInput): ProNextStep | null {
  if (!s.hasProject) return null
  if (s.flashBusy || s.debug === 'starting') return { action: 'hw', text: 'Идёт работа с платой…', title: 'Показать ход выполнения' }
  if (s.debug === 'running') return { action: 'debug', text: 'Программа выполняется', title: 'Открыть панель отладки: Пауза остановит программу' }
  if (s.debug === 'stopped') return { action: 'debug', text: 'Идите по программе: F10, F11, F5', title: 'F10 — шаг, F11 — внутрь функции, F5 — продолжить' }
  if (s.openocd === false) return { action: 'hw', text: 'Установите OpenOCD', title: 'Программа для связи с ST-Link — устанавливается одной кнопкой' }
  if (s.probesLoaded && s.probeCount === 0) return { action: 'hw', text: 'Подключите ST-Link', title: 'ST-Link по USB, провода SWDIO, SWCLK, GND и 3V3 к плате' }
  if (s.driverMissing) return { action: 'hw', text: 'Установите драйвер ST-Link', title: 'Windows не отдала ST-Link программе — нужен драйвер' }
  if (!s.hasElf) return { action: 'build', text: 'Соберите проект', title: 'Кнопка «Собрать» (Ctrl+B)' }
  if (!s.flashed) return { action: 'flash', text: 'Прошейте плату', title: 'Кнопка «Прошить» (Ctrl+U)' }
  return { action: 'debug', text: 'Начните отладку', title: 'Кнопка «Отладка» (F5): остановка на main, точки останова, шаги' }
}
