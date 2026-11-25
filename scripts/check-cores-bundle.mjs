// Проверка перед сборкой установщика: пакеты ядер, которые вкладываются в установщик, должны быть собраны.
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const need = ['avr', 'esp8266']
const missing = need.filter((id) => !existsSync(join(root, 'build', 'cores-bundle', id, 'manifest.json')))
if (missing.length) {
  console.error(`Нет пакетов ядер для установщика: ${missing.join(', ')}.\nСначала выполните: npm run build:cores  (нужен интернет, один раз; повторный запуск берёт файлы из кэша build/cores-cache)`)
  process.exit(1)
}
console.log('Пакеты ядер для установщика на месте: ' + need.join(', '))

if (!existsSync(join(root, 'build', 'libs-bundle', 'manifest.json'))) {
  console.error('Нет пакета встроенных библиотек для установщика.\nСначала выполните: npm run build:libs  (нужен интернет, один раз)')
  process.exit(1)
}
console.log('Пакет встроенных библиотек на месте')
