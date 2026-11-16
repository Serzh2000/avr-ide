import { assert, assertIncludes, editorText, openRecent } from '../lib/kit.mjs'

const GOOD = 'void setup() {\n  pinMode(2, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(2, HIGH);\n  delay(500);\n  digitalWrite(2, LOW);\n  delay(500);\n}\n'

export default {
  id: 'k',
  title: '[full] Компиляция ESP32: успех в статус-баре; ошибка → «Проблемы» → строка → маркер',
  full: true,
  arduino: 'ard2',
  timeout: 15 * 60 * 1000,
  files: { 'Comp1/Comp1.ino': GOOD, 'Comp1/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\n' },
  projects: ['Comp1'],
  async run({ page, log }) {
    await openRecent({ page }, 'Comp1')
    await page.waitFor(`/ядро 2[.]0[.]17/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 60000, what: 'в статус-баре видно ядро esp32 2.0.17' })

    // 1. Успешная сборка
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`/Компиляция|Выполняется/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 15000, what: 'сборка началась' })
    await page.waitFor(`/Собрано|Ошибка сборки/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 12 * 60 * 1000, interval: 1000, what: 'сборка завершилась' })
    const sb = await page.text('[data-testid=statusbar]')
    assertIncludes(sb, 'Собрано', 'итог сборки в статус-баре (а не ошибка). Вывод: ' + (await page.eval(`document.querySelector('.bpane:not([hidden])')?.innerText.slice(-600) ?? ''`)))
    assert(/%/.test(sb), 'в итоге есть размер/процент использования флеша: ' + sb.slice(0, 200))
    log('итог: ' + sb.split('\n').find((l) => l.includes('Собрано')))

    // 2. Ломаем код: ошибка на строке 2
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('a', { ctrl: true })
    await page.insertText('void setup() {\n  int x = ;\n}\n\nvoid loop() {\n}\n')
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`/Ошибка сборки/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 8 * 60 * 1000, interval: 1000, what: 'ошибка сборки в статус-баре' })
    await page.waitFor(`document.querySelector('[data-testid=btab-problems]')?.getAttribute('aria-selected') === 'true'`, { what: 'открылась вкладка «Проблемы»' })
    await page.waitFor(`document.querySelectorAll('[data-testid=problem]').length >= 1`, { what: 'в «Проблемах» есть записи' })
    const first = await page.text('[data-testid=problem]')
    log('первая проблема: ' + first.replace(/\s+/g, ' ').slice(0, 140))
    assert(/Comp1[.]ino:2/.test(first), 'проблема указывает на Comp1.ino:2: ' + first)
    // маркер в редакторе (волнистая линия) до клика
    await page.waitFor(`document.querySelectorAll('.view:not([hidden]) .monaco-editor .squiggly-error').length > 0`, { timeout: 8000, what: 'красный маркер ошибки в редакторе' })
    // клик по проблеме ведёт к строке
    await page.click('[data-testid=problem]')
    await page.waitFor(`/Стр 2,/.test(document.querySelector('[data-testid=statusbar]')?.innerText ?? '')`, { timeout: 8000, what: 'курсор на строке 2 после клика по проблеме' })
  }
}
