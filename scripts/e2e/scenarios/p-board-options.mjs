import { join } from 'node:path'
import { assert, assertEq, assertIncludes, readText, waitFile } from '../lib/kit.mjs'

// Платформа STM32 с параметрами платы, собранная вручную в пользовательской папке hardware (без сети и без настоящего ядра):
// проверяется интерфейс параметров — мастер, поповер шапки, sketch.yaml, строка состояния, порт при загрузке.
const PLATFORM = 'hardware/STMicroelectronics/stm32/'
const BOARDS = `menu.pnum=Board part number
menu.upload_method=Upload method
menu.usb=USB support (if available)

GenF1.name=Generic STM32F1 series
GenF1.build.core=arduino
GenF1.build.mcu=cortex-m3
GenF1.upload.tool=dummy
GenF1.menu.pnum.BLUEPILL_F103C8=BluePill F103C8
GenF1.menu.pnum.BLUEPILL_F103C8.build.board=BLUEPILL_F103C8
GenF1.menu.pnum.BLUEPILL_F103CB=BluePill F103CB (or C8 with 128k)
GenF1.menu.pnum.BLUEPILL_F103CB.build.board=BLUEPILL_F103CB
GenF1.menu.upload_method.MassStoragemethod=Mass Storage
GenF1.menu.upload_method.MassStoragemethod.upload.protocol=massstorage
GenF1.menu.upload_method.swdMethod=STM32CubeProgrammer (SWD)
GenF1.menu.upload_method.swdMethod.upload.protocol=swd
GenF1.menu.upload_method.serialMethod=STM32CubeProgrammer (Serial)
GenF1.menu.upload_method.serialMethod.upload.protocol=serial
GenF1.menu.usb.none=None
GenF1.menu.usb.CDCgen=CDC (generic 'Serial' supersede U(S)ART)
GenF1.menu.usb.CDCgen.build.enable_usb=-DUSBCON
`

const setSelect = (page, testid, value) =>
  page.eval(`(() => { const s = document.querySelector('[data-testid=${testid}]'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value })()`)

export default {
  id: 'p',
  timeout: 180000,
  title: 'Параметры платы STM32: мастер, поповер в шапке, sketch.yaml, статус-бар, порт при загрузке, заглушка ESPUI',
  hardware: { [PLATFORM + 'platform.txt']: 'name=STM32 test core\nversion=1.0.0\n', [PLATFORM + 'boards.txt']: BOARDS },
  async run({ page, sketchbook }) {
    await page.click('[data-testid=start-create]')
    await page.waitExists('[data-testid=wizard]')
    await page.waitExists('[data-testid=wz-board]', { timeout: 120000, what: 'список плат' })
    await page.fill('[data-testid=wz-search]', 'stm32')
    await page.waitExists('[data-testid=wz-board][data-fqbn="STMicroelectronics:stm32:GenF1"]', { what: 'плата STM32 из ядра' })
    // готовые варианты: Blue Pill = GenF1 + pnum
    await page.waitExists('[data-testid=wz-board][data-fqbn="STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8"]', { what: 'готовый вариант Blue Pill' })
    assert(await page.eval(`[...document.querySelectorAll('.wz-group-title')].some((e) => e.textContent === 'STM32')`), 'группа STM32')
    await page.click('[data-testid=wz-board][data-fqbn="STMicroelectronics:stm32:GenF1"]')
    await page.waitFor(`document.querySelector('[data-testid=wz-core]')?.dataset.state === 'installed'`, { what: 'ядро установлено' })

    // Свёрнутый блок «Параметры» со значениями по умолчанию
    await page.waitExists('[data-testid=wz-opts]', { timeout: 30000, what: 'блок «Параметры»' })
    assertEq(await page.eval(`document.querySelector('[data-testid=wz-opts]').open`), false, 'блок свёрнут')
    assertIncludes(await page.text('[data-testid=wz-opts] summary'), 'по умолчанию', 'подпись блока')
    await page.click('[data-testid=wz-opts] summary')
    await page.waitExists('[data-testid=wzo-upload_method]')
    assertEq(await page.eval(`document.querySelector('[data-testid=wzo-upload_method]').value`), 'MassStoragemethod', 'умолчание способа загрузки')
    await setSelect(page, 'wzo-upload_method', 'swdMethod')
    await page.waitFor(`document.querySelector('[data-testid=wz-opts] summary').innerText.includes('изменено 1')`, { what: 'параметр изменён' })
    await page.click('[data-testid=wz-next]')

    await page.waitExists('[data-testid=wz-name]')
    await page.fill('[data-testid=wz-name]', 'BluePill1')
    await page.waitFor(`document.querySelector('[data-testid=wz-create]') && !document.querySelector('[data-testid=wz-create]').disabled`, { what: 'кнопка «Создать»' })
    await page.click('[data-testid=wz-create]')
    await page.waitExists('[data-testid=header]', { timeout: 15000, what: 'проект открыт' })
    const yaml = join(sketchbook, 'BluePill1', 'sketch.yaml')
    await waitFile(yaml, 'default_fqbn: STMicroelectronics:stm32:GenF1:upload_method=swdMethod')

    // Шапка: кнопка параметров и поповер
    await page.waitExists('[data-testid=hdr-options]', { timeout: 20000, what: 'кнопка «Параметры платы»' })
    assertIncludes(await page.text('[data-testid=hdr-options]'), '1', 'счётчик изменённых параметров')
    await page.click('[data-testid=hdr-options]')
    await page.waitExists('[data-testid=options-pop]')
    assertEq(await page.eval(`document.querySelector('[data-testid=bo-upload_method]').value`), 'swdMethod', 'способ загрузки в поповере')
    assert(await page.exists('[data-testid=options-pop] .bo-note'), 'пояснение: COM-порт не нужен')
    await setSelect(page, 'bo-pnum', 'BLUEPILL_F103CB')
    await waitFile(yaml, 'pnum=BLUEPILL_F103CB')
    await setSelect(page, 'bo-usb', 'CDCgen')
    const t = await waitFile(yaml, 'usb=CDCgen')
    assertIncludes(t, 'upload_method=swdMethod', 'способ загрузки сохранён')
    assertIncludes(t, 'usb=CDCgen', 'USB сохранён')
    assert(/default_fqbn: STMicroelectronics:stm32:GenF1:[A-Za-z0-9_=,.-]+\r?\n/.test(t), 'одна строка default_fqbn с параметрами')
    // Строка состояния: краткая сводка параметров
    await page.waitFor(`(document.querySelector('[data-testid=sb-options]')?.innerText ?? '').includes('SWD')`, { what: 'параметры в строке состояния' })
    // Название модели из pnum в шапке
    await page.waitFor(`(document.querySelector('[data-testid=hdr-board] .chip-label')?.innerText ?? '').includes('BluePill F103CB')`, { what: 'модель платы в шапке' })
    // «Сбросить» убирает все параметры
    await page.click('[data-testid=bo-reset]')
    await waitFile(yaml, 'default_fqbn: STMicroelectronics:stm32:GenF1\n')
    assertEq(readText(yaml).includes('upload_method'), false, 'после сброса параметров нет')
    await setSelect(page, 'bo-upload_method', 'swdMethod')
    await waitFile(yaml, 'upload_method=swdMethod')
    await page.key('Escape')

    // SWD: загрузка не требует порта — сообщение «выберите порт» не появляется
    await page.click('[data-testid=hdr-upload]')
    await page.waitFor(`document.body.innerText.includes('без COM-порта')`, { timeout: 30000, what: 'загрузка запущена без порта' })
    assertEq(await page.exists('.port-pop'), false, 'список портов не открыт')
    await page.waitFor(`!document.querySelector('[data-testid=hdr-upload]')?.closest('.hdr-group')?.querySelector('.hbtn.stop')`, { timeout: 60000, what: 'операция завершена' })

    // Последовательный способ загрузки порт требует
    await page.click('[data-testid=hdr-options]')
    await page.waitExists('[data-testid=bo-upload_method]')
    await setSelect(page, 'bo-upload_method', 'serialMethod')
    await waitFile(yaml, 'upload_method=serialMethod')
    await page.key('Escape')
    await page.click('[data-testid=hdr-upload]')
    await page.waitExists('.port-pop', { what: 'выбор порта для serial-способа' })
    await page.key('Escape')

    // Конструкторы для STM32 — понятная заглушка
    await page.click('[data-testid=act-ui]')
    await page.waitExists('[data-testid=not-esp-stub]', { what: 'заглушка ESPUI для STM32' })
    assertIncludes(await page.text('[data-testid=not-esp-stub]'), 'работает на ESP', 'текст заглушки')
    assertEq(await page.count('[data-testid=uib]'), 0, 'конструктор ESPUI не показан')
  }
}
