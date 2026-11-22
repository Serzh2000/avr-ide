import { useDeferredValue, useMemo } from 'react'
import { useBuild } from '../build/useBuild'
import { isProjectFile, projectIssues } from '../editor/pro/projectJson'
import type { Problem } from './problems'
import { useProject } from './project'

/** Ошибки сборки и диагностика открытого файла проекта, в том числе до сохранения. */
export function useProblems(): Problem[] {
  const build = useBuild((s) => s.problems)
  const file = useProject((s) => Object.keys(s.docs).find(isProjectFile))
  const text = useDeferredValue(useProject((s) => file ? s.docs[file]?.content : undefined))
  return useMemo(() => {
    if (!file || text === undefined) return build
    const local = projectIssues(text).map(({ start, severity, message }): Problem => {
      const before = text.slice(0, start)
      return { file, severity, message, line: before.split('\n').length, column: start - before.lastIndexOf('\n') }
    })
    return local.length ? [...local, ...build] : build
  }, [build, file, text])
}
