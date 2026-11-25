import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Dialog, Field, Select } from '../shell/kit'
import { download } from './Bottom'
import { PICO_WEB_PYTHON, standaloneSketch, UNO_PAGE_GUIDE_BYTES } from './core/standalone'
import type { StaticFirmware } from './core/standalone'
import { utf8Length } from './core/escape'

const TARGETS = {
  browser: 'Браузер или любой HTTP-сервер',
  'pico-arduino': 'Pico W / Pico 2 W · Arduino-Pico',
  'pico-python': 'Pico W / Pico 2 W · CircuitPython',
  'uno-at': 'Arduino Uno R3 + ESP-12F · ESP-AT'
} as const

type Target = keyof typeof TARGETS

export default function PublishDialog({ bundle, defaultTarget, canLinkPico, onClose }: {
  bundle: string
  defaultTarget: StaticFirmware | null
  canLinkPico: boolean
  onClose: () => void
}): ReactNode {
  const [target, setTarget] = useState<Target>(defaultTarget ?? 'browser')
  const bytes = utf8Length(bundle)
  const largeUno = target === 'uno-at' && bytes > UNO_PAGE_GUIDE_BYTES
  const sketchName = target === 'uno-at' ? 'UnoWeb' : 'PicoWeb'
  const getHtml = (): void => download('page_bundle.html', bundle, 'text/html')
  const getFirmware = (): void => {
    if (target === 'pico-python') download('code.py', PICO_WEB_PYTHON, 'text/plain')
    else if ((target === 'pico-arduino' || target === 'uno-at') && !largeUno)
      download(sketchName + '.ino', standaloneSketch(bundle, target), 'text/plain')
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Dialog className="wd-publish" testid="wd-publish-dialog" title="Размещение веб-страницы" icon="web" onClose={onClose}
        footerStart={<Button onClick={onClose}>Закрыть</Button>}
        footer={<>
          <Button variant={target === 'browser' ? 'primary' : 'secondary'} onClick={getHtml}>Скачать HTML</Button>
          {target !== 'browser' && <Button variant="primary" disabled={largeUno} onClick={getFirmware}>
            Скачать {target === 'pico-python' ? 'code.py' : sketchName + '.ino'}
          </Button>}
        </>}>
        <Field label="Где будет работать страница" stack>
          <Select value={target} onChange={(e) => setTarget(e.target.value as Target)} data-testid="wd-publish-target">
            {Object.entries(TARGETS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
        </Field>
        <p>Это статический экспорт: HTML, стили и скрипты собраны в одном файле ({(bytes / 1024).toFixed(1)} КиБ). Привязки к выводам и переменным, WebSocket и OTA отключены.</p>
        {target === 'pico-arduino' && canLinkPico && <p>Для обмена данными с текущим скетчем закройте это окно и нажмите «Подключить к скетчу» в веб-дизайнере.</p>}
        {target === 'browser' && <p>Откройте <code>page_bundle.html</code> в браузере или положите его на HTTP-сервер. Изображения по внешним ссылкам загружаются отдельно.</p>}
        {target === 'pico-arduino' && <ol>
          <li>Установите ядро Arduino-Pico от Earle Philhower и выберите Pico W или Pico 2 W.</li>
          <li>Откройте <code>PicoWeb.ino</code> как отдельный скетч и укажите в нём имя сети и пароль.</li>
          <li>Загрузите скетч и откройте адрес из монитора порта (115200 бод).</li>
        </ol>}
        {target === 'pico-python' && <ol>
          <li>Установите CircuitPython для своей модели Pico W или Pico 2 W.</li>
          <li>В <code>settings.toml</code> на диске CIRCUITPY задайте <code>CIRCUITPY_WIFI_SSID</code> и <code>CIRCUITPY_WIFI_PASSWORD</code>.</li>
          <li>Скопируйте оба файла в корень CIRCUITPY и откройте адрес из последовательной консоли.</li>
        </ol>}
        {target === 'uno-at' && <>
          <ol>
            <li>Подключите ESP-12F с совместимой прошивкой ESP8266 AT 1.7.x (например, Espressif 1.7.4). Нужны отдельное питание 3,3 В, общая земля и согласование уровней UART. В скетче D6 — RX Uno, D7 — TX Uno.</li>
            <li>Установите WiFiEspAT. Настройте UART модуля на 9600 бод и сохраните сеть на модуле через пример <code>SetupPersistentWiFiConnection</code>.</li>
            <li>Откройте <code>UnoWeb.ino</code> как отдельный скетч, проверьте размер сборки, загрузите его и откройте адрес из монитора порта (115200 бод).</li>
          </ol>
          <p>Страница хранится во флеше Uno и передаётся модулю порциями. SRAM расходуется на буферы, поэтому доступный размер определяет итоговая сборка.</p>
          {largeUno && <p className="field-error" role="alert">Страница превышает ориентир {UNO_PAGE_GUIDE_BYTES / 1024} КиБ для Uno R3. Уберите тяжёлые блоки и встроенные изображения или выберите Pico W либо внешний HTTP-сервер.</p>}
        </>}
      </Dialog>
    </div>
  )
}
