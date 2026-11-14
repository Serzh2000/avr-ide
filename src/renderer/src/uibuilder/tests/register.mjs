// Загрузчик для тестов: Node запускает .ts напрямую, но требует расширения в импортах,
// а исходники используют импорты без расширения (так нужно tsc/Vite). Дописываем .ts.
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-z]+$/.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(fileURLToPath(url))) return next(url.href, context)
  }
  return next(specifier, context)
}
`),
  import.meta.url
)
