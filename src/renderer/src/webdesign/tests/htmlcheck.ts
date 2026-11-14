// Простая проверка HTML: баланс тегов, уникальность id, отсутствие «сырых» < и > в атрибутах.
const VOID = new Set(['meta', 'link', 'input', 'hr', 'br', 'img', 'path'])

export function checkHtml(html: string): string[] {
  const errs: string[] = []
  if (!/^<!DOCTYPE html>/i.test(html)) errs.push('нет DOCTYPE')
  // вырезаем содержимое script/style, чтобы не разбирать код
  const stripped = html.replace(/<!DOCTYPE html>/i, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m, t: string) => `<${t}></${t}>`)
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g
  const stack: string[] = []
  const ids = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped))) {
    const [, close, name0, attrs, selfClose] = m
    const name = name0.toLowerCase()
    if (close) {
      if (VOID.has(name)) continue
      const top = stack.pop()
      if (top !== name) errs.push(`ожидался </${top}>, найден </${name}>`)
    } else {
      for (const a of attrs.matchAll(/\sid="([^"]*)"/g)) {
        if (ids.has(a[1])) errs.push(`дубликат id ${a[1]}`)
        ids.add(a[1])
      }
      if (!VOID.has(name) && !selfClose) stack.push(name)
    }
  }
  if (stack.length) errs.push(`не закрыты теги: ${stack.join(',')}`)
  // «<» в тексте вне тегов
  const text = stripped.replace(re, '')
  if (/</.test(text)) errs.push('сырой символ < вне тегов')
  return errs
}
