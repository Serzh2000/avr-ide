// Какой файл многофайлового примера показать первым: заглушка .ino (например, `#if CORE_MOCK #include "x.cpp"`) бесполезна.

export interface ExFile { name: string; content: string }

/** Количество «содержательных» строк: без пустых и комментариев. */
export function codeLines(src: string): number {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlock.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean).length
}

/** .ino — заглушка: пустой/почти пустой, либо только включает другой файл. */
export function isStub(f: ExFile): boolean {
  if (!/\.ino$/i.test(f.name)) return false
  if (codeLines(f.content) <= 4) return true
  return /#\s*if\s+CORE_MOCK/.test(f.content) && /#\s*include\s*"[^"]+\.(?:cpp|h|hpp)"/.test(f.content) && codeLines(f.content) <= 8
}

/** Индекс файла для показа по умолчанию: если .ino — заглушка и есть .cpp/.h, берём самый большой из них. */
export function pickMainFile(files: ExFile[]): number {
  if (files.length < 2) return 0
  const first = files.findIndex((f) => /\.ino$/i.test(f.name))
  if (first < 0 || !isStub(files[first])) return first < 0 ? 0 : first
  let best = -1
  files.forEach((f, i) => { if (i !== first && /\.(cpp|c|h|hpp)$/i.test(f.name) && (best < 0 || codeLines(f.content) > codeLines(files[best].content))) best = i })
  return best < 0 ? first : best
}
