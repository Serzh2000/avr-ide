// Переключатель режима «Arduino | Профессиональный» (шапка, стартовый экран) и раздел «Режим работы» в настройках.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import './pro.css'
import './build.css'
import { Button, Spinner } from '../shell/kit'
import { useBuild } from '../build/useBuild'
import { useUi } from '../shell/ui'
import { useProBuild } from './buildStore'
import { useProStore } from './proStore'

export function ProModeSwitch({ className = '' }: { className?: string }): ReactNode {
  const pro = useProStore((s) => s.proMode)
  const set = useProStore((s) => s.setProMode)
  return (
    <div className={'pro-seg ' + className} role="group" aria-label="Режим работы" data-testid="mode-switch">
      <button data-testid="mode-arduino" aria-pressed={!pro} className={!pro ? 'on' : ''} title="Режим Arduino: скетчи, библиотеки, платы Arduino/ESP" onClick={() => set(false)}>Arduino</button>
      <button data-testid="mode-pro" aria-pressed={pro} className={pro ? 'on' : ''} title="Профессиональный режим: проект ARM без обвязки Arduino (STM32, ST-Link)" onClick={() => set(true)}>
        <span className="pro-seg-long">Профессиональный</span><span className="pro-seg-short">Pro</span>
      </button>
    </div>
  )
}

export function ProModeSettings(): ReactNode {
  const pro = useProStore((s) => s.proMode)
  return (
    <section data-testid="settings-mode">
      <h2>Режим работы</h2>
      <div className="set-row">
        <div className="set-label"><b>Режим разработки</b>
          <span className="dim">{pro
            ? 'Профессиональный: настоящий ARM-проект как в Keil или STM32CubeIDE — C/C++, CMSIS, файл запуска, скрипт компоновщика, конфигурации Debug и Release, прошивка и отладка через ST-Link. Разделы Arduino скрыты.'
            : 'Arduino: скетчи, библиотеки, платы Arduino, ESP и другие, конструкторы веб-интерфейса. Профессиональный режим — проект STM32 без обвязки Arduino.'}</span>
        </div>
        <ProModeSwitch />
      </div>
      <p className="dim small pro-set-note">Режим сохраняется. Открытие проекта переключает его само: папка с файлом avride.project.json открывается в профессиональном режиме, остальные — в режиме Arduino.</p>
      <ToolchainSettings />
    </section>
  )
}

/** Компилятор ARM: где найден, выбрать папку, установить одной кнопкой. */
function ToolchainSettings(): ReactNode {
  const tc = useProBuild((s) => s.toolchain)
  const loading = useProBuild((s) => s.toolchainLoading)
  const busy = useBuild((s) => s.busy)
  useEffect(() => { void useProBuild.getState().refreshToolchain() }, [])
  const apply = async (p: Promise<{ ok: boolean; data?: unknown; error?: string }>): Promise<void> => {
    const r = await p
    if (r.ok) useProBuild.setState({ toolchain: r.data as never })
    else useUi.getState().notify(r.error ?? 'Не удалось изменить путь к компилятору.', { kind: 'error' })
    await useProBuild.getState().refreshToolchain()
  }
  return (
    <div className="set-row" data-testid="settings-toolchain">
      <div className="set-label"><b>Компилятор ARM (arm-none-eabi-gcc)</b>
        {!tc ? <span className="dim"><Spinner /> Проверка…</span>
          : tc.found ? <span className="dim" data-testid="toolchain-status">Найден: версия {tc.version}, {tc.sourceLabel}.<code className="pb-tc-path">{tc.bin}</code></span>
          : <span className="dim" data-testid="toolchain-status">{tc.settingBad ? 'Указанный путь не подошёл: там нет рабочего arm-none-eabi-gcc. ' : 'Не найден. '}Нужен для сборки проектов STM32: можно установить в одну кнопку или указать папку с уже установленным (STM32CubeIDE, Arm GNU Toolchain, xPack).</span>}
      </div>
      <div className="pb-tc-actions">
        <Button data-testid="toolchain-pick" disabled={busy || loading} onClick={() => void apply(window.api.pro.toolchainPick())}>Выбрать папку…</Button>
        {tc?.settingPath && <Button data-testid="toolchain-clear" disabled={busy} onClick={() => void apply(window.api.pro.toolchainClear())}>Сбросить путь</Button>}
        {!tc?.found && <Button variant="primary" data-testid="toolchain-install" disabled={busy} onClick={() => useProBuild.getState().setDialog({ kind: 'toolchain', resume: false })}>Установить…</Button>}
      </div>
    </div>
  )
}
