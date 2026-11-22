// Редактор конфигураций сборки (Debug, Release и свои): оптимизация, отладочная информация, defines, дополнительные ключи. Запись — в avride.project.json.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { BuildConfiguration, DebugLevel, Optimization, ProProject } from '../../../main/pro/project/types'
import { DEBUG_LEVELS, OPTIMIZATIONS } from '../../../main/pro/project/types'
import { promptDialog } from '../shell/dialogs'
import { Button, Dialog, Field, Select } from '../shell/kit'
import { useUi } from '../shell/ui'
import { useProBuild } from './buildStore'
import { useProStore } from './proStore'
import './build.css'

const OPT_HINT: Record<Optimization, string> = {
  O0: 'без оптимизации (быстрая сборка)', Og: 'для отладки: код остаётся понятным', O1: 'лёгкая', O2: 'сильная', O3: 'максимальная скорость', Os: 'малый размер', Oz: 'минимальный размер'
}
const DBG_HINT: Record<DebugLevel, string> = { none: 'нет (-g не добавляется)', g1: '-g1: минимум (трассировка стека)', g2: '-g2: обычная', g3: '-g3: с макросами (удобно в отладчике)' }
const DEFINE_RE = /^[A-Za-z_][A-Za-z0-9_]*(=\S*)?$/

const splitWords = (s: string): string[] => s.split(/[\s,;]+/).filter(Boolean)

export default function ConfigDialog(): ReactNode {
  const project = useProStore((s) => s.project)!
  const active = useProStore((s) => s.config)
  const setDialog = useProBuild((s) => s.setDialog)
  const [cfgs, setCfgs] = useState<ProProject['configurations']>(() => JSON.parse(JSON.stringify(project.configurations)) as ProProject['configurations'])
  const [name, setName] = useState(project.configurations[active] ? active : 'Debug')
  const [defs, setDefs] = useState(() => (cfgs[name]?.defines ?? []).join(' '))
  const [flags, setFlags] = useState(() => (cfgs[name]?.extraFlags ?? []).join('\n'))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const cur = cfgs[name]
  const badDefine = useMemo(() => splitWords(defs).find((d) => !DEFINE_RE.test(d)), [defs])
  const close = (): void => { if (!busy) setDialog(null) }

  const commit = (): ProProject['configurations'] => ({ ...cfgs, [name]: { ...cur, defines: splitWords(defs), extraFlags: flags.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) } })
  const patch = (p: Partial<BuildConfiguration>): void => setCfgs((c) => ({ ...c, [name]: { ...c[name], ...p } }))
  const switchTo = (n: string): void => { const all = commit(); setCfgs(all); setName(n); setDefs(all[n].defines.join(' ')); setFlags(all[n].extraFlags.join('\n')) }

  const add = async (): Promise<void> => {
    const n = await promptDialog({ title: 'Новая конфигурация', label: `Имя (копия «${name}»)`, okLabel: 'Создать', validate: (v) => (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(v) ? 'Латиница, цифры, «_» и «-», с буквы.' : cfgs[v] ? 'Такая конфигурация уже есть.' : null) })
    if (!n) return
    const all = { ...commit(), [n]: JSON.parse(JSON.stringify({ ...commit()[name] })) as BuildConfiguration }
    setCfgs(all); setName(n); setDefs(all[n].defines.join(' ')); setFlags(all[n].extraFlags.join('\n'))
  }
  const remove = (): void => {
    if (name === 'Debug' || name === 'Release') return
    const { [name]: _, ...rest } = commit()
    void _
    setCfgs(rest as ProProject['configurations']); const n = 'Debug'; setName(n); setDefs(rest[n].defines.join(' ')); setFlags(rest[n].extraFlags.join('\n'))
  }

  const save = async (): Promise<void> => {
    if (busy) return
    const configurations = commit()
    for (const [configName, config] of Object.entries(configurations)) {
      const invalid = config.defines.find((define) => !DEFINE_RE.test(define))
      if (invalid) {
        setErr(`В конфигурации «${configName}» неверный макрос «${invalid}». Используйте ИМЯ или ИМЯ=значение без пробелов.`)
        return
      }
    }
    setBusy(true); setErr(null)
    try {
      const r = await window.api.pro.saveProject({ ...project, configurations })
      if (!r.ok) { setErr(r.error); return }
      await useProStore.getState().reloadProject()
      if (!configurations[useProStore.getState().config]) useProStore.getState().setConfig('Debug')
      useUi.getState().notify('Конфигурации сохранены в avride.project.json.', { kind: 'ok' })
      setDialog(null)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Не удалось сохранить конфигурации.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close() }} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); close() } }}>
      <Dialog className="pb-dlg" testid="pb-configs" title="Конфигурации сборки" icon="sliders" ariaLabel="Конфигурации сборки" onClose={close} closeDisabled={busy}
        footerStart={<Button disabled={busy} data-testid="pb-cfg-add" onClick={() => void add()}>Новая…</Button>}
        footer={<>
          {name !== 'Debug' && name !== 'Release' && <Button disabled={busy} variant="danger" onClick={remove} data-testid="pb-cfg-del">Удалить «{name}»</Button>}
          <Button disabled={busy} onClick={close}>Отмена</Button>
          <Button variant="primary" data-testid="pb-cfg-save" loading={busy} onClick={() => void save()}>Сохранить</Button>
        </>}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <Field label="Конфигурация">
            <Select data-testid="pb-cfg-name" value={name} onChange={(e) => switchTo(e.target.value)}>
              {Object.keys(cfgs).map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <Field label="Оптимизация" hint={OPT_HINT[cur.optimization]}>
            <Select data-testid="pb-cfg-opt" value={cur.optimization} onChange={(e) => patch({ optimization: e.target.value as Optimization })}>
              {OPTIMIZATIONS.map((o) => <option key={o} value={o}>-{o}</option>)}
            </Select>
          </Field>
          <Field label="Отладочные данные" hint={DBG_HINT[cur.debugLevel]}>
            <Select data-testid="pb-cfg-dbg" value={cur.debugLevel} onChange={(e) => patch({ debugLevel: e.target.value as DebugLevel })}>
              {DEBUG_LEVELS.map((o) => <option key={o} value={o}>{o === 'none' ? 'нет' : '-' + o}</option>)}
            </Select>
          </Field>
          <Field label="Макросы (-D)" hint={badDefine ? undefined : `Общие для всех конфигураций: ${project.defines.join(', ') || 'нет'}. Через пробел: DEBUG USE_FEATURE=1`} error={badDefine ? `«${badDefine}»: нужен вид ИМЯ или ИМЯ=значение` : undefined}>
            <input className={'input' + (badDefine ? ' invalid' : '')} data-testid="pb-cfg-defs" value={defs} onChange={(e) => setDefs(e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Доп. параметры" hint="Один ключ в строке. Ключи компоновщика (-Wl,…, -l…, -T…) уйдут линкеру, остальные — компилятору.">
            <textarea className="input pb-flags" data-testid="pb-cfg-flags" rows={4} value={flags} onChange={(e) => setFlags(e.target.value)} spellCheck={false} placeholder={'-Wextra\n-Wl,--print-memory-usage'} />
          </Field>
        </fieldset>
        {err && <div role="alert" className="field-error" data-testid="pb-cfg-error">{err}</div>}
      </Dialog>
    </div>
  )
}
