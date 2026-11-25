import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { assert, assertIncludes, openRecent, waitFile } from '../lib/kit.mjs'

const board = 'default_fqbn: arduino:avr:uno\n'
const sketch = 'void setup() {} void loop() {}\n'
const panelSelector = '[data-testid=project-dependencies]'

async function openDependencies(page) {
  if (!(await page.eval(`!!document.querySelector('[data-testid=act-libs][aria-pressed="true"]')`))) {
    await page.click('[data-testid=act-libs]')
  }
  await page.waitExists(panelSelector)
}

export default {
  id: 'aj',
  title: '[full] Открытие скетча скачивает библиотеки Arduino и их зависимости в пустой каталог',
  full: true,
  arduino: 'clean-libraries',
  timeout: 240_000,
  files: {
    'Sensor/Sensor.ino': '#include <DHT.h>\n' + sketch,
    'Sensor/sketch.yaml': board,
    'Sensor/avr-ide-libraries.json': JSON.stringify({ libraries: ['DHT sensor library@1.4.6'] }),
    'Modem/Modem.ino': '#include <WiFiEspAT.h>\n' + sketch,
    'Modem/sketch.yaml': board,
    'Choice/Choice.ino': '#include <Adafruit_NeoPixel.h>\n#include <PrivateBoardDriver123.h>\n' + sketch,
    'Choice/sketch.yaml': board,
    'OtherVersion/OtherVersion.ino': '#include <DHT.h>\n' + sketch,
    'OtherVersion/sketch.yaml': board,
    'OtherVersion/avr-ide-libraries.json': JSON.stringify({ libraries: ['DHT sensor library@1.4.7'] })
  },
  projects: ['Sensor', 'Modem', 'Choice', 'OtherVersion'],
  async run({ page, app }) {
    const libs = join(app.ard.user, 'libraries')
    assert(!existsSync(libs) || readdirSync(libs).length === 0, 'общий каталог библиотек пуст перед запуском')
    await openRecent({ page }, 'Sensor')
    await waitFile(join(libs, 'DHT_sensor_library', 'library.properties'), 'version=1.4.6', 90_000)
    await waitFile(join(libs, 'Adafruit_Unified_Sensor', 'library.properties'), 'name=Adafruit Unified Sensor', 60_000)
    await openDependencies(page)
    await page.waitExists('[data-testid=deps-ready]')
    await page.click('[data-testid=hdr-close-project]')
    await page.waitExists('[data-testid=start-screen]')
    await openRecent({ page }, 'Modem')
    await waitFile(join(libs, 'WiFiEspAT', 'library.properties'), 'name=WiFiEspAT', 90_000)
    await openDependencies(page)
    await page.waitExists('[data-testid=deps-ready]')
    await page.click('[data-testid=hdr-close-project]')
    await page.waitExists('[data-testid=start-screen]')
    await openRecent({ page }, 'Choice')
    await openDependencies(page)
    await page.waitFor(`document.querySelector('${panelSelector}')?.textContent.includes('выберите нужную библиотеку')`)
    const panel = await page.text(panelSelector)
    assertIncludes(panel, 'Adafruit_NeoPixel.h', 'для неоднозначного заголовка показан выбор')
    assertIncludes(panel, 'PrivateBoardDriver123.h', 'неизвестный заголовок показывается отдельно')
    const before = readdirSync(libs)
    assert(!before.includes('Adafruit_NeoPixel') && !before.includes('Seven_Segment_Pixel'), 'конфликтующие поставщики не скачаны автоматически')
    await page.click({ sel: `${panelSelector} button`, text: 'Adafruit NeoPixel@' })
    await waitFile(join(libs, 'Adafruit_NeoPixel', 'library.properties'), 'name=Adafruit NeoPixel', 90_000)
    assert(readdirSync(libs).filter((name) => !before.includes(name)).join() === 'Adafruit_NeoPixel', 'установлена только выбранная библиотека')
    await page.click('[data-testid=hdr-close-project]')
    await page.waitExists('[data-testid=start-screen]')
    await openRecent({ page }, 'OtherVersion')
    await openDependencies(page)
    await page.waitFor(`document.querySelector('${panelSelector}')?.textContent.includes('проекту нужна 1.4.7')`)
    assertIncludes(await waitFile(join(libs, 'DHT_sensor_library', 'library.properties'), 'version=1.4.6'), 'version=1.4.6', 'не перезаписана общая библиотека')
  }
}
