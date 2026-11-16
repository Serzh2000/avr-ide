import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../lib/app.mjs'
import { assert, assertEq, assertIncludes, readText } from '../lib/kit.mjs'
import { sleep } from '../lib/cdp.mjs'

const BLINK = 'void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}\n'

/** Ждёт конца установки ядра в карточке мастера; печатает этапы. */
async function waitInstalled(page, log, what) {
  const t0 = Date.now()
  let last = ''
  for (;;) {
    const st = await page.eval(`(() => { const c = document.querySelector('[data-testid=wz-core]'); return c ? { state: c.dataset.state, text: c.innerText.replace(/\\s+/g, ' ').slice(0, 220) } : null })()`)
    if (st && st.text !== last) { last = st.text; log(`${what}, ${Math.round((Date.now() - t0) / 1000)} с: ${st.state}: ${st.text.slice(0, 140)}`) }
    if (st?.state === 'installed') return
    if (st?.state === 'failed') throw new Error(`${what}: установка из комплекта не удалась: ${st.text}`)
    if (Date.now() - t0 > 8 * 60 * 1000) throw new Error(`${what}: не завершилось за 8 минут: ${st?.text}`)
    await sleep(1000)
  }
}

export default {
  id: 'm',
  title: '[full] Ядра из комплекта БЕЗ ИНТЕРНЕТА: Uno и NodeMCU из встроенных пакетов → проект → сборка',
  full: true,
  arduino: 'empty',
  timeout: 20 * 60 * 1000,
  // Сеть для arduino-cli перекрыта неработающим прокси: любая попытка скачать что-либо падает
  env: { ARDUINO_NETWORK_PROXY: 'http://127.0.0.1:1' },
  async run({ page, sketchbook, app, log }) {
    const dl = join(app.ard.dl, 'packages')
    await page.click('[data-testid=start-create]')
    await page.waitExists('[data-testid=wizard]')
    await page.waitExists('[data-testid=wz-board]', { timeout: 60000, what: 'список плат в мастере' })

    // 1. Arduino Uno: основной кнопкой предлагается комплект
    await page.fill('[data-testid=wz-search]', 'arduino uno')
    await page.click('[data-testid=wz-board][data-fqbn="arduino:avr:uno"]')
    await page.waitExists('[data-testid=wz-kit]', { timeout: 20000, what: 'предложение установить из комплекта' })
    assertIncludes(await page.text('[data-testid=wz-kit]'), 'без интернета', 'текст про установку без интернета')
    assert(await page.exists('[data-testid=wz-install-pack]'), 'есть кнопка «Установить из комплекта»')
    assertIncludes(await page.text('[data-testid=wz-install-core]'), 'Скачать из интернета', 'вторая кнопка — скачивание')
    await page.click('[data-testid=wz-install-pack]')
    await waitInstalled(page, log, 'AVR')
    assert(existsSync(join(app.ard.data, 'packages', 'arduino', 'hardware', 'avr', '1.8.8')), 'ядро arduino:avr 1.8.8 установлено обычным образом (packages/arduino/hardware/avr/1.8.8)')
    assert(existsSync(join(app.ard.data, 'packages', 'arduino', 'tools', 'avr-gcc')), 'установлен компилятор avr-gcc')
    assert(existsSync(join(app.ard.data, 'packages', 'builtin', 'tools', 'ctags')), 'установлены встроенные инструменты arduino-cli (ctags, дискавери)')
    assert(!readdirSync(dl).some((f) => /avr/i.test(f)), 'временные копии архивов удалены из staging: ' + readdirSync(dl).join(', '))

    // 2. NodeMCU (ESP8266)
    await page.fill('[data-testid=wz-search]', 'nodemcu')
    await page.click('[data-testid=wz-board][data-fqbn="esp8266:esp8266:nodemcuv2"]')
    await page.waitFor(`!!document.querySelector('[data-testid=wz-kit]')`, { timeout: 20000, what: 'комплект ESP8266 предложен' })
    assertIncludes(await page.text('[data-testid=wz-kit]'), 'адрес пакетов', 'для ESP говорится, что будет добавлен адрес пакетов')
    await page.click('[data-testid=wz-install-pack]')
    await waitInstalled(page, log, 'ESP8266')
    assert(existsSync(join(app.ard.data, 'packages', 'esp8266', 'hardware', 'esp8266', '3.1.2')), 'ядро esp8266 3.1.2 установлено')
    assert(!readdirSync(dl).some((f) => /esp8266|xtensa|mkspiffs|mklittlefs|python3/i.test(f)), 'временные копии удалены')
    assert(existsSync(join(app.ard.data, 'package_esp8266com_index.json')), 'индекс ESP8266 лежит в каталоге данных')
    assertIncludes(readText(join(app.ard.data, 'arduino-cli.yaml')), 'package_esp8266com_index.json', 'адрес пакетов ESP8266 добавлен в настройки arduino-cli')

    // 3. Проект для NodeMCU и сборка без сети
    await page.click('[data-testid=wz-next]')
    await page.waitExists('[data-testid=wz-name]')
    await page.fill('[data-testid=wz-name]', 'KitNodeMcu')
    await page.waitFor(`!document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать» доступна' })
    await page.click('[data-testid=wz-create]')
    await page.waitExists('[data-testid=header]', { timeout: 15000, what: 'открыт проект' })
    assertIncludes(readText(join(sketchbook, 'KitNodeMcu', 'sketch.yaml')), 'default_fqbn: esp8266:esp8266:nodemcuv2', 'sketch.yaml')
    await page.waitFor(`!document.querySelector('[data-testid=hdr-verify]')?.disabled`, { timeout: 30000, what: 'кнопка «Проверить» доступна' })
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`/Собрано|Ошибка сборки/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 8 * 60 * 1000, interval: 1000, what: 'сборка для NodeMCU завершилась' })
    assertIncludes(await page.text('[data-testid=statusbar]'), 'Собрано', 'сборка NodeMCU без интернета успешна')
    log('NodeMCU: ' + (await page.text('[data-testid=statusbar]')).split('\n').find((l) => l.includes('Собрано')))

    // 4. Панель «Платы»: раздел «Комплект» показывает установленные пакеты
    await page.click('[data-testid=act-boards]')
    await page.waitExists('[data-testid=kit-section]', { timeout: 20000, what: 'раздел «Комплект»' })
    await page.waitFor(`document.querySelectorAll('[data-testid=kit-pack][data-status=installed]').length >= 2`, { timeout: 20000, what: 'в «Комплекте» avr и esp8266 помечены установленными' })

    // 5. Независимая проверка: тот же arduino-cli (без сети) видит оба ядра и собирает скетч для Uno
    const cli = join(ROOT, 'resources', 'arduino-cli.exe')
    const env = { ...process.env, ARDUINO_DIRECTORIES_DATA: app.ard.data, ARDUINO_DIRECTORIES_USER: app.ard.user, ARDUINO_DIRECTORIES_DOWNLOADS: app.ard.dl, ARDUINO_NETWORK_PROXY: 'http://127.0.0.1:1' }
    const list = spawnSync(cli, ['core', 'list'], { env, encoding: 'utf8' })
    assertIncludes(list.stdout, 'arduino:avr', 'core list: avr')
    assertIncludes(list.stdout, 'esp8266:esp8266', 'core list: esp8266')
    const sk = join(app.tmp, 'UnoKit')
    mkdirSync(sk, { recursive: true })
    writeFileSync(join(sk, 'UnoKit.ino'), BLINK)
    const c = spawnSync(cli, ['compile', '--fqbn', 'arduino:avr:uno', sk], { env, encoding: 'utf8' })
    assertEq(c.status, 0, 'компиляция Uno без сети: ' + (c.stdout + c.stderr).slice(-400))
    assert(/использует|uses/i.test(c.stdout), 'размер скетча для Uno в выводе')
  }
}
