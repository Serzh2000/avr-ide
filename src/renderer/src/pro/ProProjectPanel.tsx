// Боковая панель «Проект»: исходники, заголовки, startup, скрипт компоновщика, документы, конфигурации и цель.
import type { ReactNode } from 'react'
import type { TreeNode } from '../../../main/files/types'
import type { ProProject } from '../../../main/pro/project/types'
import { Icon, FileIcon } from '../shell/icons'
import { Button, EmptyState } from '../shell/kit'
import { isDirty, useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import { PROGRAMMER_LABEL, useProStore } from './proStore'
import { runExportBuild, runProBuild, runProClean, useProBuild } from './buildStore'
import { openPins } from './pins/pinsStore'
import './build.css'
import './pro.css'

const norm = (s: string): string => s.toLowerCase()

/** Узел дерева по относительному пути с разделителем «/». */
export function findNode(tree: TreeNode[], rel: string): TreeNode | null {
  let level = tree
  let found: TreeNode | null = null
  for (const part of rel.split('/')) {
    found = level.find((n) => norm(n.name) === norm(part)) ?? null
    if (!found) return null
    level = found.children ?? []
  }
  return found
}

/** Все файлы узла (для папки — рекурсивно). */
export function filesOf(node: TreeNode): TreeNode[] {
  return node.dir ? (node.children ?? []).flatMap(filesOf) : [node]
}

const KB = (n: number): string => (n >= 1024 * 1024 ? `${+(n / 1048576).toFixed(2)} МБ` : `${+(n / 1024).toFixed(n % 1024 ? 1 : 0)} КБ`)

function Group({ title, count, testid, children }: { title: string; count?: number; testid: string; children: ReactNode }): ReactNode {
  return (
    <section className="pro-group" data-testid={testid}>
      <h3 className="pro-group-title"><span>{title}</span>{count !== undefined && <span className="pro-count">{count}</span>}</h3>
      {children}
    </section>
  )
}

function FileRow({ node, label }: { node: TreeNode; label?: string }): ReactNode {
  const openFile = useProject((s) => s.openFile)
  const current = useProject((s) => s.activeId === node.path)
  const dirty = useProject((s) => isDirty(s.docs[node.path]))
  return (
    <button className={'tree-row pro-row' + (current ? ' current selected' : '')} data-testid="pro-file" data-name={node.name} onClick={() => void openFile(node.path)} title={node.path}>
      <FileIcon name={node.name} />
      <span className="tree-name">{label ?? node.name}</span>
      {dirty && <span className="pro-dirty" aria-label="Не сохранён" />}
    </button>
  )
}

function Missing({ path }: { path: string }): ReactNode {
  return <div className="tree-row pro-row missing" title="Файл или папка указаны в avride.project.json, но их нет на диске"><Icon name="warn" size={14} /><span className="tree-name">{path}</span><span className="dim small">нет на диске</span></div>
}

function Entries({ tree, paths, empty }: { tree: TreeNode[]; paths: string[]; empty: string }): ReactNode {
  if (paths.length === 0) return <div className="pro-empty dim small">{empty}</div>
  return (
    <>
      {paths.map((rel) => {
        const n = findNode(tree, rel)
        if (!n) return <Missing key={rel} path={rel} />
        const files = filesOf(n)
        if (files.length === 0) return <div key={rel} className="pro-empty dim small">{rel}: папка пуста</div>
        return files.map((f) => <FileRow key={f.path} node={f} label={n.dir && !rel.includes('/') ? rel + '/' + f.path.slice(n.path.length + 1).replace(/\\/g, '/') : undefined} />)
      })}
    </>
  )
}

function Configs({ project }: { project: ProProject }): ReactNode {
  const config = useProStore((s) => s.config)
  const setConfig = useProStore((s) => s.setConfig)
  return (
    <>
      {Object.entries(project.configurations).map(([name, c]) => (
        <button key={name} className={'tree-row pro-row' + (name === config ? ' selected' : '')} data-testid="pro-cfg" data-name={name} aria-pressed={name === config} onClick={() => setConfig(name)}
          title={`Оптимизация -${c.optimization}, отладочная информация: ${c.debugLevel === 'none' ? 'нет' : '-' + c.debugLevel}`}>
          <span className="pro-radio" aria-hidden="true">{name === config && <Icon name="check" size={12} />}</span>
          <span className="tree-name">{name}</span>
          <span className="dim small">-{c.optimization} · {c.debugLevel === 'none' ? 'без -g' : '-' + c.debugLevel}</span>
        </button>
      ))}
    </>
  )
}

export default function ProProjectPanel(): ReactNode {
  const project = useProStore((s) => s.project)
  const error = useProStore((s) => s.projectError)
  const tree = useProject((s) => s.tree)
  const hasRoot = useProject((s) => !!s.root)
  const setWizard = useUi((s) => s.setWizard)
  const title = (
    <div className="side-title"><span className="grow">Проект</span></div>
  )
  if (!hasRoot || !project) {
    return (
      <>
        {title}
        <div className="side-scroll" data-testid="pro-project">
          <EmptyState icon="board" title={error ? 'Файл проекта с ошибкой' : 'Это не проект STM32'}
            hint={error ?? 'В открытой папке нет файла avride.project.json. Создайте проект профессионального режима — появится структура с исходниками, конфигурациями и целью.'}>
            <Button variant="primary" data-testid="pro-new" onClick={() => setWizard(true)}>Создать проект STM32</Button>
          </EmptyState>
        </div>
      </>
    )
  }
  const t = project.target
  const docs = ['README.md', 'docs'].filter((p) => findNode(tree, p))
  const extra = t.memory.extra ?? []
  return (
    <>
      {title}
      <div className="side-scroll pro-scroll" data-testid="pro-project">
        <div className="pro-name" title={project.name}><b>{project.name}</b><span className="dim small">{t.chip}</span></div>
        <Group title="Конфигуратор" testid="pro-pins-group">
          <div className="pb-actions">
            <Button size="sm" data-testid="pro-open-pins" title="Выводы, периферия и тактирование: схема корпуса, генерация кода gpio, clock, uart" onClick={openPins}><Icon name="board" size={13} /> Пины и тактирование…</Button>
          </div>
        </Group>
        <Group title="Исходники" testid="pro-sources" count={project.sources.length}><Entries tree={tree} paths={project.sources} empty="Нет исходников" /></Group>
        <Group title="Заголовки" testid="pro-includes"><Entries tree={tree} paths={project.includes} empty="Папки заголовков не заданы" /></Group>
        <Group title="Запуск (startup)" testid="pro-startup"><Entries tree={tree} paths={[project.startupFile]} empty="" /></Group>
        <Group title="Скрипт компоновщика" testid="pro-linker"><Entries tree={tree} paths={[project.linkerScript]} empty="" /></Group>
        {project.svd && <Group title="Описание регистров (SVD)" testid="pro-svd"><Entries tree={tree} paths={[project.svd]} empty="" /></Group>}
        <Group title="Документы" testid="pro-docs"><Entries tree={tree} paths={docs} empty="README.md и папка docs пока отсутствуют" /></Group>
        <Group title="Конфигурации" testid="pro-configs">
          <Configs project={project} />
          <Button size="sm" className="pb-cfg-edit" data-testid="pro-cfg-edit" onClick={() => useProBuild.getState().setDialog({ kind: 'configs' })}><Icon name="sliders" size={13} /> Изменить…</Button>
        </Group>
        <Group title="Сборка" testid="pro-build-group">
          <div className="pb-actions">
            <Button size="sm" data-testid="pro-act-build" onClick={() => void runProBuild()}><Icon name="check" size={13} /> Собрать</Button>
            <Button size="sm" data-testid="pro-act-clean" onClick={() => void runProClean()}><Icon name="trash" size={13} /> Очистить результаты</Button>
            <Button size="sm" data-testid="pro-act-export" title="Создать Makefile и CMakeLists.txt, чтобы собирать вне IDE" onClick={() => void runExportBuild()}><Icon name="external" size={13} /> Экспорт сборки…</Button>
            <Button size="sm" data-testid="pro-act-size" onClick={() => useUi.getState().showBottom('size')}><Icon name="chart" size={13} /> Размер программы</Button>
          </div>
        </Group>
        <Group title="Цель" testid="pro-targets">
          <div className="pro-kv"><span>Чип</span><b>{t.chip}</b></div>
          {t.board && <div className="pro-kv"><span>Плата</span><b>{t.board}</b></div>}
          <div className="pro-kv"><span>Ядро</span><b>{t.core}</b></div>
          <div className="pro-kv"><span>Flash</span><b>{KB(t.memory.flash.size)} · {t.memory.flash.origin}</b></div>
          <div className="pro-kv"><span>RAM</span><b>{KB(t.memory.ram.size)} · {t.memory.ram.origin}</b></div>
          {extra.map((r) => <div className="pro-kv" key={r.name}><span>{r.name}</span><b>{KB(r.size)} · {r.origin}</b></div>)}
          <div className="pro-kv"><span>Программатор</span><b>{PROGRAMMER_LABEL[project.programmer.kind] ?? project.programmer.kind}, SWD</b></div>
        </Group>
      </div>
    </>
  )
}
