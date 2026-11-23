import { join } from 'node:path'
import { assert, assertEq, assertIncludes, openRecent } from '../lib/kit.mjs'

const sketch = 'void setup() {}\nvoid loop() {}\n'

export default {
  id: 'ah',
  title: 'Arduino: порт проекта, актуальность сборки и подтверждение BOOTSEL',
  arduino: 'ard2',
  files: {
    'SerialSketch/SerialSketch.ino': sketch,
    'SerialSketch/sketch.yaml': 'default_fqbn: esp32:esp32:esp32\ndefault_port: COM9999\n',
    'PicoSketch/PicoSketch.ino': sketch,
    'PicoSketch/sketch.yaml': 'default_fqbn: rp2040:rp2040:rpipico2w\n'
  },
  projects: ['SerialSketch', 'PicoSketch'],
  async run({ page, sketchbook }) {
    const nextStep = '[data-testid=next-step]'
    await openRecent({ page }, 'SerialSketch')
    assertIncludes(await page.text('[data-testid=hdr-port]'), 'COM9999', 'порт указан в sketch.yaml')

    // Без явного порта arduino-cli не должен сам применить default_port.
    const file = JSON.stringify(join(sketchbook, 'SerialSketch', 'SerialSketch.ino'))
    const unsafeUpload = await page.eval(`window.api.cli.upload(${file}, 'esp32:esp32:esp32', null)`)
    assert(!unsafeUpload.ok && unsafeUpload.error.includes('default_port'), 'IPC заблокировал загрузку с неявным портом')
    await page.click('[data-testid=hdr-port]')
    await page.click('[data-testid=clear-upload-port]')
    assertEq(await page.eval(`document.activeElement?.dataset.testid`), 'hdr-port', 'фокус вернулся после снятия выбора порта')
    await page.click('[data-testid=hdr-verify]')
    await page.waitFor(`window.__avrStores.useBuild.getState().result?.ok === true`, { timeout: 120000, what: 'скетч собран' })
    await page.waitFor(`/порт/.test(document.querySelector('${nextStep}')?.textContent ?? '')`, { what: 'сборка актуальна, нужен порт' })
    await page.click('.view:not([hidden]) .monaco-editor .view-lines')
    await page.key('End', { ctrl: true })
    await page.insertText('\n// После сборки\n')
    await page.key('s', { ctrl: true })
    await page.waitFor(`/Проверьте/.test(document.querySelector('${nextStep}')?.textContent ?? '')`, { what: 'правка требует повторной проверки' })
    await page.waitFor(`!document.querySelector('[data-testid=tab][aria-selected=true] .tab-close.dirty')`, { what: 'изменения сохранены' })
    assertIncludes(await page.text(nextStep), 'Проверьте', 'сохранение не возвращает устаревший результат')

    // При открытии нового скетча порт прошлого проекта не наследуется.
    await page.eval(`window.__avrStores.useUi.setState({ port: 'COM9999' })`)
    await page.click('[data-testid=hdr-close-project]')
    await openRecent({ page }, 'PicoSketch')
    assertIncludes(await page.text('[data-testid=hdr-port]'), 'Нет порта', 'старый порт сброшен')
    await page.eval(`(() => {
      const { useBuild } = window.__avrStores
      useBuild.setState({ cores: [{ id: 'rp2040:rp2040', installed: '6.4.0' }],
        result: { kind: 'compile', ok: true, cancelled: false, size: null, at: Date.now() } })
    })()`)
    await page.waitFor(`/BOOTSEL/.test(document.querySelector('${nextStep}')?.textContent ?? '')`, { what: 'для Pico предлагается загрузка без COM' })
    await page.click(nextStep)
    await page.waitFor(`[...document.querySelectorAll('[role=dialog]')].some((el) => /Загрузить через BOOTSEL/.test(el.textContent ?? ''))`, { what: 'подтверждение загрузки через BOOTSEL' })
    await page.click({ sel: '[role=dialog] button', text: 'Отмена' })
    assert(!await page.eval(`window.__avrStores.useBuild.getState().busy`), 'отмена подтверждения не запустила прошивку')
  }
}
