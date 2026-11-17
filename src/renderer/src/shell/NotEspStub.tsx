// Заглушка конструкторов (ESPUI, веб-дизайнер) для плат без Wi-Fi-стека ESP: STM32, RP2040 и прочих ядер.
import type { ReactNode } from 'react'
import type { TargetPlatform } from '../contracts'
import { EmptyState } from './kit'
import { useUi } from './ui'

const NAMES: Partial<Record<TargetPlatform, string>> = { stm32: 'STM32', rp2040: 'Raspberry Pi Pico (RP2040/RP2350)', generic: 'выбранной платы' }

/** Конструкторы работают только на ESP32/ESP8266 (и AVR как раньше). Для остальных плат — понятное объяснение вместо пустого холста. */
export const needsEsp = (p: TargetPlatform | null | undefined): boolean => p === 'stm32' || p === 'rp2040' || p === 'generic'

export default function NotEspStub({ tool, platform }: { tool: string; platform: TargetPlatform | null }): ReactNode {
  const setPicker = useUi((s) => s.setPicker)
  return (
    <div style={{ height: "100%" }} data-testid="not-esp-stub">
      <EmptyState icon="board" title={`${tool} работает на ESP`}
        hint={`Он строит веб-интерфейс на Wi-Fi-модуле ESP32 или ESP8266, а для платы ${NAMES[platform ?? 'generic'] ?? 'выбранной платы'} такого нет. Для неё пишите код в редакторе и подключайте библиотеки; справочник и подсказки работают как обычно.`}>
        <button className="btn" onClick={() => setPicker('board')}>Выбрать другую плату</button>
      </EmptyState>
    </div>
  )
}
