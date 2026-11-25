import { useEffect, useRef } from 'react'
import { useBuild } from '../build/useBuild'
import { Button } from '../shell/kit'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import { useProStore } from '../pro/proStore'
import { checkDependencies, dependencyKey, useProjectDependencies } from './projectDependencies'

export function useDependencyOnOpen(): void {
  const key = useDependencyTarget()
  const cli = useBuild((s) => s.status?.path)
  const busy = useBuild((s) => s.busy)
  const auto = useUi((s) => s.settings.autoRestoreLibraries)
  const doneKey = useRef('')
  useEffect(() => {
    if (!key || !cli) { doneKey.current = ''; return }
    const scope = `${key}\n${cli}\n${auto}`
    if (doneKey.current === scope || busy) return
    doneKey.current = scope
    void checkDependencies('auto')
  }, [key, cli, auto, busy])
}

function useDependencyTarget(): string {
  const root = useProject((s) => s.kind === 'arduino' && s.mainFile ? s.root : null)
  const fqbn = useUi((s) => s.fqbn)
  const pro = useProStore((s) => s.proMode)
  return root && fqbn && !pro ? dependencyKey(root, fqbn) : ''
}

const arg = (dep: { name: string; version?: string }): string => dep.version ? `${dep.name}@${dep.version}` : dep.name

export default function ProjectDependencies() {
  const key = useDependencyTarget()
  const state = useProjectDependencies((s) => s.key === key ? s : undefined)
  const busy = useBuild((s) => s.busy)
  const showOutput = useUi((s) => s.showBottom)
  if (!key) return null
  const plan = state?.plan
  const disabled = busy || state?.pending
  const ready = !!plan && !plan.profile && !state?.error && !plan.install.length && !plan.needsIndex && !plan.unknown.length && !plan.conflicts.length && !plan.choose.length
  if (ready && !state?.pending) {
    return (
      <section className="side-pad dep-ready" data-testid="project-dependencies">
        <span className="dim" data-testid="deps-ready">✓ Библиотеки скетча на месте</span>
        <button className="link-btn" disabled={disabled} onClick={() => void checkDependencies('scan')}>Проверить</button>
      </section>
    )
  }
  return (
    <section className="side-pad" data-testid="project-dependencies">
      <b>Зависимости скетча</b>
      {state?.pending && <p className="dim" aria-live="polite">Проверка или установка…</p>}
      {state?.error && <p role="alert">{state.error} <Button size="sm" onClick={() => showOutput('output')}>Вывод</Button></p>}
      {plan?.profile ? <p className="dim">Профиль Arduino CLI «{plan.profile}»: недостающее скачивается в отдельный кэш при сборке.</p> : <>
        {plan?.install.length ? <p>{plan.install.map(arg).join(', ')}</p> : null}
        {plan?.needsIndex && <p>Нужно скачать индекс библиотек Arduino.</p>}
        {!!plan?.unknown.length && <p className="dim">Не найдено в реестре: {plan.unknown.join(', ')}. Проверьте документацию скетча.</p>}
        {plan?.conflicts.map((text) => <p key={text}>{text}</p>)}
        {plan?.choose.map(({ header, libraries }) => <div key={header}>
          <p><code>{header}</code> — выберите нужную библиотеку:</p>
          {libraries.map((dep) => <div key={dep.name}><Button size="sm" disabled={disabled} onClick={() => void checkDependencies('install', arg(dep))}>{arg(dep)}</Button></div>)}
        </div>)}
        {plan && !plan.install.length && !plan.needsIndex && !plan.unknown.length && !plan.conflicts.length && !plan.choose.length &&
          <p className="dim" data-testid="deps-ready">Недостающие библиотеки не обнаружены.</p>}
        <div className="row-actions">
          {(!!plan?.install.length || plan?.needsIndex) &&
            <Button variant="primary" size="sm" disabled={disabled} onClick={() => void checkDependencies('install')}>Установить найденные</Button>}
          <Button size="sm" disabled={disabled} onClick={() => void checkDependencies('scan')}>Перепроверить</Button>
          {!!plan?.unknown.length && <Button size="sm" disabled={disabled} onClick={() => void checkDependencies('refresh')}>Обновить индекс</Button>}
        </div>
      </>}
    </section>
  )
}
