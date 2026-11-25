// Снимок панели «Библиотеки» без установленных ядер (карточка установки платформ).
//   node scripts/e2e/shots-libs.mjs <папка-вывода>
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './lib/app.mjs'
import { openRecent } from './lib/kit.mjs'
import { sleep } from './lib/cdp.mjs'

const out = resolve(process.argv[2] ?? 'shots-libs')
mkdirSync(out, { recursive: true })
const app = await launch({
  arduino: 'clean-libraries',
  files: { 'Lib1/Lib1.ino': 'void setup() {}\nvoid loop() {}\n', 'Lib1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Lib1']
})
try {
  await openRecent({ page: app.page }, 'Lib1')
  await app.page.click('[data-testid=act-libs]')
  await sleep(1500)
  await app.page.shot(join(out, 'libs-setup.png'))
} finally {
  await app.close?.()
}
