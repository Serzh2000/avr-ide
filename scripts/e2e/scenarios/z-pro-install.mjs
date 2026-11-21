// Pro: нет OpenOCD → предложение установить с подтверждением (файл, размер, источник, лицензия, SHA-256). План подставлен AVRIDE_PRO_INSTALL_PLAN,
// в сеть сценарий не ходит и ничего не скачивает: проверяется только окно подтверждения и отмена.
import { assert, assertEq, assertIncludes } from '../lib/kit.mjs'

const PROJECT = {
  schemaVersion: 1, name: 'NoOcd',
  target: { vendor: 'st', family: 'STM32F1', chip: 'STM32F103C8T6', core: 'cortex-m3', memory: { flash: { origin: '0x08000000', size: 65536 }, ram: { origin: '0x20000000', size: 20480 } } },
  sources: ['src'], includes: ['include'], defines: ['STM32F103xB'], linkerScript: 'linker/a.ld', startupFile: 'startup/a.s',
  configurations: { Debug: { optimization: 'Og', debugLevel: 'g3', defines: [], extraFlags: [] }, Release: { optimization: 'Os', debugLevel: 'none', defines: [], extraFlags: [] } },
  toolchain: { kind: 'arm-none-eabi-gcc' }, programmer: { kind: 'stlink', interface: 'swd' }
}
const SHA = 'ab'.repeat(32)

export default {
  id: 'z',
  timeout: 90000,
  title: 'Pro: OpenOCD не найден — установка только после подтверждения (источник, размер, лицензия, SHA-256)',
  files: { 'NoOcd/avride.project.json': JSON.stringify(PROJECT), 'NoOcd/src/main.c': 'int main(void) { return 0; }\n' },
  projects: ['NoOcd'],
  env: {
    AVRIDE_PRO_PROBES: '[]',
    AVRIDE_PRO_INSTALL_PLAN: JSON.stringify({ tag: 'v0.12.0-7', file: 'xpack-openocd-0.12.0-7-win32-x64.zip', size: 3225998, url: 'https://example.invalid/x.zip', sha256: SHA, source: 'github.com/xpack-dev-tools/openocd-xpack (релиз v0.12.0-7)', license: 'GPL-2.0' })
  },
  async run({ page, log }) {
    await page.click({ sel: '[data-testid=start-recent]', text: 'NoOcd' })
    await page.waitExists('[data-testid=header][data-mode=pro]', { timeout: 40000 })
    await page.waitFor(`/не найден/.test(document.querySelector('[data-testid=pro-probe]')?.innerText ?? '')`, { what: 'ST-Link не найден в шапке' })
    await page.click('[data-testid=btab-hw]')
    await page.waitExists('[data-testid=hw-panel]')
    await page.waitFor(`!!document.querySelector('[data-testid=hw-openocd]')?.innerText`, { what: 'проверка инструментов' })
    if (!/не найден/.test(await page.text('[data-testid=hw-openocd]'))) { log('на этом компьютере OpenOCD уже найден — проверка установки пропущена'); return }

    // ST-Link не найден — одно главное действие и пошаговая подсказка
    await page.waitExists('[data-testid=hw-error]')
    assertEq(await page.count('[data-testid=hw-error-action]'), 1, 'одно главное действие')
    await page.click('[data-testid=hw-install]')
    await page.waitExists('[data-testid=hw-install-confirm-card]', { what: 'окно подтверждения установки' })
    const t = await page.text('[data-testid=hw-install-confirm-card]')
    for (const need of ['xpack-openocd-0.12.0-7-win32-x64.zip', '3,1 МБ', 'xpack-dev-tools/openocd-xpack', 'GPL-2.0', 'abababababababab']) assertIncludes(t, need, 'в подтверждении: ' + need)
    assert(await page.exists('[data-testid=hw-install-confirm]'), 'есть кнопка «Скачать и установить»')
    await page.click({ sel: '[data-testid=hw-install-confirm-card] button', text: 'Отмена' })
    await page.waitGone('[data-testid=hw-install-confirm-card]')
    // «Прошить» без OpenOCD приводит к тому же предложению, а не к ошибке
    await page.click('[data-testid=pro-flash]')
    await page.waitExists('[data-testid=hw-install-confirm-card]', { what: 'предложение установки после «Прошить»' })
    await page.click({ sel: '[data-testid=hw-install-confirm-card] button', text: 'Отмена' })
    assertEq(await page.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true, 'нет горизонтального скролла')
  }
}
