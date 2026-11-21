// Карточки Pro-сборки: «Установить компилятор ARM», «Скачать файлы CMSIS для чипа», «Создать скрипт компоновки». У каждой одно главное действие.
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SupportStatus } from '../../../main/pro/build/types'
import { useBuild } from '../build/useBuild'
import { Icon } from '../shell/icons'
import { Button, Dialog } from '../shell/kit'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'
import ConfigDialog from './ConfigDialog'
import { resumeBuild, useProBuild } from './buildStore'
import { useProStore } from './proStore'
import './build.css'

export const fmtMb = (n: number): string => (n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(1).replace('.', ',') + ' ГБ' : Math.max(1, Math.round(n / 1048576)) + ' МБ')
const fmtBytes = (n: number): string => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ')

function Progress(): ReactNode {
  const progress = useBuild((s) => s.progress)
  const pct = progress?.pct
  return (
    <div className="pb-progress" data-testid="pb-progress" role="status">
      <div className="pb-progress-label">{progress?.label ?? 'Выполняется…'}{pct != null ? ` · ${Math.round(pct)}%` : ''}</div>
      <div className={'bar' + (pct == null ? ' indeterminate' : '')}><div style={pct != null ? { width: Math.max(2, pct) + '%' } : undefined} /></div>
    </div>
  )
}

/** Установка компилятора: подтверждение с размером и источником, ход, отмена. */
export function ToolchainDialog({ resume }: { resume: boolean }): ReactNode {
  const tc = useProBuild((s) => s.toolchain)
  const installing = useProBuild((s) => s.installing) === 'toolchain'
  const setDialog = useProBuild((s) => s.setDialog)
  const cancel = useBuild((s) => s.cancel)
  const [err, setErr] = useState<string | null>(null)
  const pkg = tc?.pkg
  const close = (): void => setDialog(null)

  const install = async (): Promise<void> => {
    setErr(null)
    useProBuild.setState({ installing: 'toolchain' })
    useBuild.getState().append('\n=== Установка компилятора ARM ===\n')
    useUi.getState().showBottom('output')
    const d = await useBuild.getState().run(window.api.pro.toolchainInstall(), 'core-install', 'Скачивание компилятора ARM')
    useProBuild.setState({ installing: null })
    const st = await useProBuild.getState().refreshToolchain()
    if (d && d.code === 0 && !d.cancelled && st?.found) {
      close()
      useUi.getState().notify(`Компилятор установлен: arm-none-eabi-gcc ${st.version ?? ''}`, { kind: 'ok' })
      if (resume) resumeBuild()
    } else setErr(d?.cancelled ? 'Установка отменена.' : 'Не удалось установить компилятор. Подробности — во вкладке «Вывод».')
  }
  const pick = async (): Promise<void> => {
    setErr(null)
    const r = await window.api.pro.toolchainPick()
    if (!r.ok) { setErr(r.error); return }
    useProBuild.setState({ toolchain: r.data })
    if (r.data.found && r.data.source === 'setting') {
      close()
      useUi.getState().notify(`Компилятор найден: arm-none-eabi-gcc ${r.data.version ?? ''}`, { kind: 'ok' })
      if (resume) resumeBuild()
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !installing) close() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !installing) { e.stopPropagation(); close() } }}>
      <Dialog className="pb-dlg" testid="pb-toolchain" title="Установить компилятор ARM" icon="download" ariaLabel="Установить компилятор ARM" onClose={close} closeDisabled={installing}
        footerStart={!installing && <Button data-testid="pb-pick" onClick={() => void pick()}><Icon name="folderOpen" size={14} /> Указать папку…</Button>}
        footer={installing
          ? <Button variant="danger" data-testid="pb-cancel" onClick={cancel}><Icon name="stop" size={13} fill /> Отменить</Button>
          : <>
              <Button onClick={close} data-testid="pb-later">Не сейчас</Button>
              <Button variant="primary" data-testid="pb-install" disabled={!pkg?.supported} onClick={() => void install()}><Icon name="download" size={14} /> {err ? 'Повторить' : 'Скачать и установить'}</Button>
            </>}>
        <p className="pb-lead">Для сборки проектов STM32 нужен компилятор <b>arm-none-eabi-gcc</b>. Он не найден на этом компьютере (проверены PATH, настройки, STM32CubeIDE, Arm GNU Toolchain и xPack).</p>
        {pkg ? (
          <dl className="pb-facts" data-testid="pb-facts">
            <dt>Что</dt><dd>{pkg.title}</dd>
            <dt>Откуда</dt><dd><code>{pkg.host}</code> (релизы xPack на GitHub)</dd>
            <dt>Размер</dt><dd>скачать {fmtMb(pkg.downloadBytes)}, на диске ≈ {fmtMb(pkg.diskBytes)}</dd>
            <dt>Проверка</dt><dd>SHA-256: <code>{pkg.sha256.slice(0, 16)}…</code>, файл удаляется при несовпадении</dd>
            <dt>Лицензия</dt><dd>{pkg.license}</dd>
          </dl>
        ) : <div className="dim">Загрузка сведений…</div>}
        {!pkg?.supported && pkg && <div className="field-error">Автоматическая установка доступна только в Windows. Установите компилятор вручную и нажмите «Указать папку…».</div>}
        {installing && <Progress />}
        {err && <div className="field-error" data-testid="pb-error">{err}</div>}
        <p className="dim small pb-note">Компилятор ставится в папку данных IDE, ничего не меняет в системе и не требует прав администратора. Исходные тексты: {pkg?.sources ? <span>{pkg.sources}</span> : null}</p>
      </Dialog>
    </div>
  )
}

/** Скачивание файлов CMSIS (startup, заголовки, system_*.c) из репозиториев ST. */
export function SupportDialog({ status }: { status: SupportStatus }): ReactNode {
  const installing = useProBuild((s) => s.installing) === 'support'
  const setDialog = useProBuild((s) => s.setDialog)
  const cancel = useBuild((s) => s.cancel)
  const [err, setErr] = useState<string | null>(null)
  const close = (): void => setDialog(null)
  const go = async (): Promise<void> => {
    setErr(null)
    useProBuild.setState({ installing: 'support' })
    useBuild.getState().append('\n=== Файлы CMSIS для чипа ===\n')
    useUi.getState().showBottom('output')
    const d = await useBuild.getState().run(window.api.pro.supportInstall(), 'core-install', 'Скачивание файлов CMSIS')
    useProBuild.setState({ installing: null })
    if (d && d.code === 0 && !d.cancelled) {
      await useProject.getState().refreshTree()
      close()
      resumeBuild()
    } else setErr(d?.cancelled ? 'Скачивание отменено.' : 'Не удалось получить файлы. Подробности — во вкладке «Вывод».')
  }
  const offline = status.cached
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !installing) close() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !installing) { e.stopPropagation(); close() } }}>
      <Dialog className="pb-dlg" testid="pb-support" title="Скачать файлы CMSIS" icon="download" ariaLabel="Скачать файлы CMSIS" onClose={close} closeDisabled={installing}
        footer={installing
          ? <Button variant="danger" data-testid="pb-cancel" onClick={cancel}><Icon name="stop" size={13} fill /> Отменить</Button>
          : <>
              <Button onClick={close} data-testid="pb-later">Не сейчас</Button>
              <Button variant="primary" data-testid="pb-support-go" onClick={() => void go()}><Icon name="download" size={14} /> {offline ? 'Добавить в проект' : err ? 'Повторить' : 'Скачать и собрать'}</Button>
            </>}>
        <p className="pb-lead">В проекте нет файла запуска (startup) и заголовков CMSIS для {status.chip}. Без них программа не соберётся. Они берутся из первоисточников ST и добавляются в папки <code>startup/</code> и <code>drivers/CMSIS/</code>.</p>
        <dl className="pb-facts" data-testid="pb-facts">
          <dt>Откуда</dt><dd>{status.sources.map((s) => <div key={s}><code>{s}</code></div>)}</dd>
          <dt>Размер</dt><dd>{offline ? 'уже загружены ранее, интернет не нужен' : `скачать ${fmtBytes(status.downloadBytes)}`} ({status.missing.length} файлов)</dd>
          <dt>Проверка</dt><dd>каждый файл сверяется с git SHA-1 из манифеста IDE; при несовпадении не сохраняется</dd>
          <dt>Лицензия</dt><dd>{status.licenses.join(', ')}</dd>
        </dl>
        {installing && <Progress />}
        {err && <div className="field-error" data-testid="pb-error">{err}</div>}
      </Dialog>
    </div>
  )
}

/** Нет скрипта компоновки: создать по карте памяти чипа. */
export function LinkerDialog({ message }: { message: string }): ReactNode {
  const setDialog = useProBuild((s) => s.setDialog)
  const project = useProStore((s) => s.project)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const close = (): void => setDialog(null)
  const create = async (): Promise<void> => {
    setBusy(true); setErr(null)
    const r = await window.api.pro.generateLinker(false)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    await useProject.getState().refreshTree()
    close()
    resumeBuild()
  }
  const m = project?.target.memory
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close() }} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); close() } }}>
      <Dialog className="pb-dlg" testid="pb-linker" title="Нет скрипта компоновки" icon="warn" ariaLabel="Нет скрипта компоновки" onClose={close} closeDisabled={busy}
        footer={<>
          <Button onClick={close}>Не сейчас</Button>
          <Button variant="primary" data-testid="pb-linker-go" loading={busy} onClick={() => void create()}>Создать по карте памяти</Button>
        </>}>
        <p className="pb-lead">{message}</p>
        {m && <p className="dim">Будет создан стандартный скрипт GNU ld: Flash {m.flash.size / 1024} КБ с {m.flash.origin}, RAM {m.ram.size / 1024} КБ с {m.ram.origin}{(m.extra ?? []).map((e) => `, ${e.name} ${e.size / 1024} КБ`).join('')}; секции .isr_vector, .text, .rodata, .data, .bss, куча и стек. Файл можно править вручную.</p>}
        {err && <div className="field-error">{err}</div>}
      </Dialog>
    </div>
  )
}

/** Все диалоги сборки в одном месте (монтируется в App). */
export default function ProBuildDialogs(): ReactNode {
  const d = useProBuild((s) => s.dialog)
  if (!d) return null
  if (d.kind === 'toolchain') return <ToolchainDialog resume={d.resume} />
  if (d.kind === 'support') return <SupportDialog status={d.status} />
  if (d.kind === 'linker') return <LinkerDialog message={d.message} />
  return <ConfigDialog />
}
