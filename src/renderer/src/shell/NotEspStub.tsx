// Пояснение для плат, с которыми не работает библиотека ESPUI.
import type { ReactNode } from 'react'
import type { TargetPlatform } from '../contracts'
import { EmptyState, Button } from './kit'
import { useUi } from './ui'
import { useProject } from './project'
import { isPicoWBoard } from '../webdesign/core/targets'

const NAMES: Partial<Record<TargetPlatform, string>> = { stm32: 'STM32', rp2040: 'Raspberry Pi Pico (RP2040/RP2350)', generic: 'выбранной платы' }

/** Для этих архитектур ESPUI показывает пояснение вместо холста. */
export const needsEsp = (p: TargetPlatform | null | undefined): boolean => p === 'stm32' || p === 'rp2040' || p === 'generic'

export default function NotEspStub({ tool, platform }: { tool: string; platform: TargetPlatform | null }): ReactNode {
  const setPicker = useUi((s) => s.setPicker)
  const picoW = isPicoWBoard(useUi((s) => s.fqbn))
  return (
    <div style={{ height: "100%" }} data-testid="not-esp-stub">
      <EmptyState icon="board" title={`${tool} работает на ESP`}
        hint={picoW ? 'ESPUI не поддерживает Pico W и Pico 2 W. Для связи страницы с вашим Arduino-скетчем используйте веб-дизайнер.'
          : `Библиотека ESPUI предназначена для ESP32 и ESP8266. Выбранная плата (${NAMES[platform ?? 'generic'] ?? 'другое ядро'}) не поддерживается.`}>
        {picoW ? <Button onClick={() => useProject.getState().openPanel('web')}>Открыть веб-дизайнер</Button>
          : <Button onClick={() => setPicker('board')}>Выбрать другую плату</Button>}
      </EmptyState>
    </div>
  )
}
