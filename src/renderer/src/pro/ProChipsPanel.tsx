// Боковая панель «Чипы и платы»: чипы и платы STM32, доступные в мастере; вход в справочник плат и распиновки.
// Позже данные берутся из ChipDatabase (этап D, src/main/pro/interfaces.ts).
import type { ReactNode } from 'react'
import { PRO_PRESETS } from '../../../main/pro/project/presets'
import { Button } from '../shell/kit'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import './pro.css'

const KB = (n: number): string => `${n / 1024} КБ`

export default function ProChipsPanel(): ReactNode {
  const openPanel = useProject((s) => s.openPanel)
  const setWizard = useUi((s) => s.setWizard)
  const families = [...new Set(PRO_PRESETS.map((p) => p.family))]
  return (
    <>
      <div className="side-title"><span className="grow">Чипы и платы</span></div>
      <p className="side-sub">Чипы и платы STM32, для которых мастер создаёт проект.</p>
      <div className="pro-actions">
        <Button data-testid="pro-open-ref" onClick={() => openPanel('ref')}>Справочник плат и распиновки</Button>
      </div>
      <div className="side-scroll pro-scroll" data-testid="pro-chips">
        {families.map((f) => (
          <section className="pro-group" key={f}>
            <h3 className="pro-group-title"><span>{f}</span></h3>
            {PRO_PRESETS.filter((p) => p.family === f).map((p) => (
              <button key={p.chip} className="pro-chip-row" data-testid="pro-chip-item" data-chip={p.chip} onClick={() => setWizard('stm32', p.chip)} title={`Создать проект для ${p.chip}`}>
                <span className="pro-chip-name">{p.chip}</span>
                <span className="dim small">{p.board}</span>
                <span className="dim small">Flash {KB(p.flashBytes)} · RAM {KB(p.ramBytes)}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}
