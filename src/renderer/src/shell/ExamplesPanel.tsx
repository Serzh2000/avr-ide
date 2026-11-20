// Панель «Примеры»: библиотека → пример, поиск, фильтр по плате, предпросмотр кода и «Открыть как проект».
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'
import { archMatches, coreOfFqbn } from '../../../main/examples/core'
import type { ExampleLib, ExamplesList } from '../../../main/examples/scan'
import { boardName } from './commands'
import { openExampleAsProject, showExample, useExamplePick } from './ExampleView'
import { Icon } from './icons'
import { EmptyState, Button, Skeleton } from './kit'
import { useUi } from './ui'

interface ExState {
  list: ExamplesList | null
  loading: boolean
  error: string | null
  load: (force?: boolean) => Promise<void>
}
const useExamples = create<ExState>((set, get) => ({
  list: null,
  loading: false,
  error: null,
  load: async (force = false) => {
    if (get().loading) return
    set({ loading: true })
    const r = await window.api.examples.list(force)
    set(r.ok ? { list: r.data, loading: false, error: null } : { loading: false, error: r.error })
  }
}))

interface Section { title: string; hint: string; libs: ExampleLib[] }

function sections(libs: ExampleLib[], fqbn: string, all: boolean, tokens: string[]): Section[] {
  const c = coreOfFqbn(fqbn)
  const fit = (l: ExampleLib): boolean => all || !c || (l.origin === 'core' ? l.core === c.core : archMatches(l.architectures, c.arch))
  const hit = (l: ExampleLib): boolean => !tokens.length || tokens.every((t) => (l.name + ' ' + l.examples.map((e) => e.name).join(' ')).toLowerCase().includes(t))
  const pick = (o: ExampleLib['origin']): ExampleLib[] => libs.filter((l) => l.origin === o && fit(l) && hit(l))
  return [
    { title: 'Для выбранной платы', hint: 'Библиотеки, которые идут вместе с поддержкой платы (ядром)', libs: pick('core') },
    { title: 'Встроенные библиотеки', hint: 'Библиотеки, которые идут вместе с arduino-cli', libs: pick('builtin') },
    { title: 'Ваши библиотеки', hint: 'Установленные библиотеки (папка Arduino/libraries)', libs: pick('user') }
  ].filter((s) => s.libs.length)
}

export default function ExamplesPanel(): ReactNode {
  const { list, loading, error, load } = useExamples()
  const fqbn = useUi((s) => s.fqbn)
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const [openLibs, setOpenLibs] = useState<Record<string, boolean>>({})
  const sel = useExamplePick((s) => s.sel)

  useEffect(() => { void load() }, [load])

  const tokens = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q])
  const secs = useMemo(() => sections(list?.libs ?? [], fqbn, all, tokens), [list, fqbn, all, tokens])
  const c = coreOfFqbn(fqbn)
  const count = secs.reduce((n, s) => n + s.libs.reduce((m, l) => m + l.examples.length, 0), 0)

  return (
    <div className="examples-panel">
      <div className="side-title">
        <span className="grow">Примеры</span>
        <button className="icon-btn" title="Обновить список с диска" onClick={() => void load(true)}><Icon name="refresh" size={15} /></button>
      </div>
      <div className="side-search">
        <Icon name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти пример или библиотеку" aria-label="Поиск примеров" spellCheck={false} />
        {q && <button className="icon-btn" title="Очистить" onClick={() => setQ('')}><Icon name="x" size={13} /></button>}
      </div>
      <label className="ex-filter" title="Показывать только то, что работает на выбранной плате">
        <input type="checkbox" checked={!all} onChange={(e) => setAll(!e.target.checked)} />
        <span>Только для платы: <b>{fqbn ? boardName(fqbn) : 'не выбрана'}</b></span>
      </label>
      <div className="ex-tree">
        {loading && !list && <Skeleton rows={7} label="Ищу примеры на диске…" />}
        {error && <div className="field-error pad">{error}</div>}
        {list && secs.map((s) => (
          <div key={s.title}>
            <div className="mgr-sub" title={s.hint}>{s.title}</div>
            {s.libs.map((l) => {
              const key = l.id
              const open = tokens.length > 0 || !!openLibs[key]
              return (
                <div key={key}>
                  <button className="ex-lib" aria-expanded={open} onClick={() => setOpenLibs({ ...openLibs, [key]: !openLibs[key] })} title={l.architectures[0] === '*' ? 'Подходит любой плате' : 'Платы: ' + l.architectures.join(', ')}>
                    <span className="tree-chev"><Icon name={open ? 'chevD' : 'arrow'} size={11} /></span>
                    <span className="ex-libname">{l.name}</span>
                    <span className="badge">{l.examples.length}</span>
                  </button>
                  {open && l.examples.map((e) => (
                    <button key={e.id} className={'ex-item' + (sel?.id === e.id ? ' on' : '')} onClick={() => showExample(e.id, l.name, e.name)}
                      onDoubleClick={() => void openExampleAsProject(e.id, l.name + ' / ' + e.name)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); void openExampleAsProject(e.id, l.name + ' / ' + e.name) } }}
                      title={e.name + ' — клик: посмотреть, двойной клик или Enter: открыть как проект'}>
                      <Icon name="file" size={13} /> <span className="ex-itemname">{e.name}</span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
        {list && !loading && secs.length === 0 && (
          <EmptyState icon="code" title={tokens.length ? 'Ничего не найдено' : 'Примеров пока нет'}
            hint={tokens.length ? 'Попробуйте другое слово или снимите фильтр по плате.' : (!all && c ? 'Для выбранной платы примеров не нашлось. Установите поддержку платы или библиотеки (разделы «Платы» и «Библиотеки») или снимите фильтр.' : 'Примеры приходят вместе с поддержкой плат и библиотеками — установите их в разделах «Платы» и «Библиотеки».')}>
            {!tokens.length && <Button size="sm" onClick={() => useUi.getState().showSide('boards')}>Открыть «Платы»</Button>}
          </EmptyState>
        )}
        {list && count > 0 && <div className="gh-count dim">Примеров: {count}{list.truncated ? ' (показана часть)' : ''}</div>}
      </div>
    </div>
  )
}
