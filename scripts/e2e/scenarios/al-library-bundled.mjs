import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assert, openRecent, waitFile } from '../lib/kit.mjs'

export default {
  id: 'al',
  title: 'Встроенные библиотеки: ESPUI и Async TCP ставятся из установщика без сети',
  arduino: 'clean-libraries',
  env: { ARDUINO_NETWORK_PROXY: 'http://127.0.0.1:1' },
  files: {
    'Bundled/Bundled.ino': '#include <ESPUI.h>\nvoid setup() {} void loop() {}\n',
    'Bundled/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n'
  },
  projects: ['Bundled'],
  async run({ page, app }) {
    const libs = join(app.ard.user, 'libraries')
    await openRecent({ page }, 'Bundled')
    await waitFile(join(libs, 'ESPUI', 'library.properties'), 'name=ESPUI', 60_000)
    await waitFile(join(libs, 'Async_TCP', 'library.properties'), 'name=Async TCP', 60_000)
    assert(existsSync(join(libs, 'ESP_Async_WebServer')), 'веб-сервер установлен из пакета')
    await waitFile(join(libs, 'ArduinoJson', 'library.properties'), 'name=ArduinoJson', 60_000)
  }
}
