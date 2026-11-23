import type { ReactNode } from 'react'
import { openCircuitPython } from '../circuitpython/store'
import ProNewProjectWizard from '../pro/ProNewProjectWizard'
import { Icon } from './icons'
import { Dialog } from './kit'
import NewProjectWizard from './NewProjectWizard'
import { useUi } from './ui'

const choices = [
  { kind: 'arduino', title: 'Скетч Arduino', detail: 'C++ с Arduino API. В том числе для ESP и Raspberry Pi Pico.', icon: 'file' },
  { kind: 'stm32', title: 'STM32 C/C++', detail: 'CMSIS, доступ к регистрам, прошивка и отладка через программатор.', icon: 'board' },
  { kind: 'circuitpython', title: 'CircuitPython для Pico', detail: 'Редактор Python с записью code.py на диск CIRCUITPY.', icon: 'code' }
] as const

export default function ProjectWizard(): ReactNode {
  const wizard = useUi((s) => s.wizard)
  const setWizard = useUi((s) => s.setWizard)
  if (wizard === 'arduino') return <NewProjectWizard />
  if (wizard === 'stm32') return <ProNewProjectWizard />
  if (!wizard) return null
  const close = (): void => setWizard(false)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <Dialog className="project-kind-dialog" testid="project-kind-dialog" title="Создать проект" onClose={close}>
        <div className="project-kind-list">
          {choices.map(({ kind, title, detail, icon }) => (
            <button key={kind} type="button" data-testid={`project-kind-${kind}`} onClick={() => {
              if (kind === 'circuitpython') { close(); openCircuitPython() }
              else setWizard(kind)
            }}>
              <Icon name={icon} size={18} />
              <span><b>{title}</b><span className="dim">{detail}</span></span>
              <Icon name="chevR" size={15} />
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  )
}
