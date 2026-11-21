// Таймер долгой сборки и пояснение про первую сборку платы. Чистые функции — их проверяют тесты.

/** 42 -> «0:42», 125 -> «2:05», 3725 -> «1:02:05». */
export function fmtElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Первая сборка платы (кэша ядра нет): определяем по длительности, а не по файлам — сборка идёт дольше 30 секунд и ещё не дошла до линковки. */
export function isLongFirstBuild(elapsedSec: number, phaseLabel: string | undefined): boolean {
  return elapsedSec >= 30 && !/Линковка|Готово/.test(phaseLabel ?? '')
}

export const FIRST_BUILD_HINT = 'Первая сборка платы занимает несколько минут: компилируется ядро, дальше будет быстрее.'
