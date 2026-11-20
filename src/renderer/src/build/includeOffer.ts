// После установки библиотеки: предложить добавить её #include в главный файл (заголовки берутся из provides_includes arduino-cli).
import { hasInclude, includeLine, insertInclude } from '../shell/libInclude'
import { useProject } from '../shell/project'
import { useUi } from '../shell/ui'

export async function offerInclude(name: string): Promise<void> {
  const r = await window.api.cli.installedLibs()
  if (!r.ok) return
  const header = r.data.find((l) => l.name.toLowerCase() === name.toLowerCase())?.includes?.[0]
  if (!header) return
  const p = useProject.getState()
  const main = p.mainFile
  const code = main ? p.docs[main]?.content : undefined
  if (!main || code === undefined || hasInclude(code, header)) return
  useUi.getState().notify(`Библиотека «${name}» установлена. Чтобы пользоваться ей, добавьте ${includeLine(header)} в скетч.`, {
    kind: 'ok',
    action: { label: 'Добавить #include', run: () => { const cur = useProject.getState().docs[main]?.content; if (cur !== undefined) useProject.getState().setContent(main, insertInclude(cur, header)) } }
  })
}
