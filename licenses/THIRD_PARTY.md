# Сторонние компоненты AVR IDE

| Компонент | Лицензия | Где используется |
|---|---|---|
| Electron | MIT (текст — LICENSE.electron.txt) | оболочка приложения |
| Monaco Editor | MIT | редактор кода |
| React, Zustand | MIT | интерфейс |
| ESPUI (фронтенд, s00500/ESPUI) | MIT, см. ESPUI-LICENSE.txt | живое превью конструктора ESPUI |
| arduino-cli (Arduino SA) | GPL-3.0 или коммерческая, см. arduino-cli-LICENSE.txt | сборка и прошивка; поставляется отдельным исполняемым файлом `arduino-cli.exe` рядом с приложением. Исходный код: https://github.com/arduino/arduino-cli |

Библиотеки Arduino (ESPUI и др.) в дистрибутив не входят и скачиваются пользователем через arduino-cli со своими лицензиями. Ядра AVR, ESP8266 и ESP32 с инструментами поставляются как «пакеты ядер» — см. раздел ниже.

## Ядра плат и инструменты, поставляемые вместе с IDE («пакеты ядер»)

Пакеты собирает `npm run build:cores` (см. `scripts/README.md`) строго по официальным индексам пакетов; контрольные суммы архивов сверяются с индексом при сборке и с `manifest.json` при установке. Архивы кладутся в установщик (AVR, ESP8266: `resources/cores/`) или поставляются отдельным пакетом (ESP32: `AVR-IDE-core-esp32-<версия>`) и устанавливаются обычным `arduino-cli core install`. Содержимое архивов не изменяется. Пометка «проверено» — лицензия прочитана в самом архиве или в индексе; «не проверено» — указана по сведениям проекта-источника, файла лицензии в архиве нет.

| Компонент (версия) | Источник | Лицензия | Проверка |
|---|---|---|---|
| Arduino AVR Boards (ядро) 1.8.8 | https://github.com/arduino/ArduinoCore-avr, индекс downloads.arduino.cc | LGPL-2.1+ | проверено по заголовкам исходников ядра (Arduino.h); отдельных файлов лицензии в архиве нет; в архиве есть вложенные сторонние лицензии (bootloaders, drivers, firmwares) |
| avr-gcc 7.3.0-atmel3.6.1-arduino7 (сборка Arduino, включает binutils и avr-libc) | downloads.arduino.cc | GPL-3.0+ (GCC, binutils); avr-libc — BSD-подобная | не проверено: файлов лицензий в архиве нет |
| avrdude 8.0-arduino.1 | downloads.arduino.cc | GPL-2.0+ | проверено (LICENSE.txt в архиве: GPL v2) |
| arduinoOTA 1.3.0 | downloads.arduino.cc | GPL-2.0 (по сведениям проекта arduino/arduinoOTA) | не проверено: файлов лицензии в архиве нет |
| ctags 5.8-arduino11 (встроенный инструмент arduino-cli) | downloads.arduino.cc | GPL-2.0+ (Exuberant Ctags) | не проверено: в архиве только ctags.exe |
| dfu-discovery 0.1.2, mdns-discovery 1.1.0, serial-discovery 1.5.2, serial-monitor 0.15.0 (встроенные инструменты arduino-cli) | downloads.arduino.cc, исходники https://github.com/arduino | GPL-3.0 | проверено (LICENSE.txt в каждом архиве: GPL v3) |
| ESP8266 Arduino Core 3.1.2 | https://github.com/esp8266/Arduino, индекс arduino.esp8266.com | LGPL-2.1 | проверено (LICENSE в архиве; вложенные библиотеки — каждая со своим LICENSE) |
| xtensa-lx106-elf (GCC 10.3.0, сборка ESP8266 Community) | https://github.com/earlephilhower/esp-quick-toolchain | GPL-3.0+ (GCC, binutils), с исключением для библиотек времени выполнения | не проверено: файлов лицензий в архиве нет |
| mkspiffs, mklittlefs (ESP8266 и ESP32) | ESP8266 Community / Espressif | MIT (mkspiffs), BSD-3-Clause (mklittlefs) — по сведениям проектов | не проверено: файлов лицензии в архивах нет |
| Python 3.7.2 embeddable (python3 для ESP8266) | https://www.python.org | PSF License | не проверено: файла лицензии в архиве нет |
| arduino-esp32 3.3.12 (ядро ESP32) | https://github.com/espressif/arduino-esp32, индекс espressif.github.io | LGPL-2.1+ | проверено по заголовкам исходников ядра (Arduino.h); отдельного файла лицензии в архиве нет |
| esp-x32 и esp-rv32 2601 (xtensa-esp-elf и riscv32-esp-elf, GCC 14.2.0) | https://github.com/espressif/crosstool-NG | GPL-3.0+ (GCC, binutils), с исключением для библиотек времени выполнения; newlib и др. — свои лицензии | проверено для xtensa-esp-elf (share/licenses: COPYING3 и др.); для riscv32-esp-elf — по аналогии, не проверено |
| xtensa-esp-elf-gdb, riscv32-esp-elf-gdb 17.1 | Espressif | GPL-3.0+ (GDB) | не проверено: файлов лицензии в архивах нет |
| openocd-esp32 0.12.0-esp32 | https://github.com/espressif/openocd-esp32 | GPL-2.0 | не проверено: файла лицензии в архиве нет |
| esptool 5.3.1 | https://github.com/espressif/esptool | GPL-2.0+ | проверено (LICENSE в архиве: GPL v2) |
| dfu-util 0.11-arduino5 | downloads.arduino.cc | GPL-2.0 | не проверено: файла лицензии в архиве нет |
| esp32-libs (esp32, c3, c5, c6, h2, p4, p4_es, s2, s3) 3.3.12 — предсобранные библиотеки ESP-IDF | Espressif | ESP-IDF: Apache-2.0 и лицензии вложенных компонентов | не проверено |

Распространяя установщик или пакет ядра с GPL-компонентами, нужно сопровождать их предложением исходного кода (ссылки на репозитории — в таблице выше; исходники GCC/binutils сборок Arduino и Espressif доступны в проектах-источниках) и текстами лицензий. Индексы пакетов (`package_*_index.json`) и индекс библиотек (`library_index.json`), входящие в пакеты, — служебные данные соответствующих проектов.

## Рисунки плат справочника («Платы и распиновка»)

Все рисунки — рендеры собственных 3D-моделей AVR IDE (`scripts/boardart/boards.py`, `boards2.py`, `render.py`; рендер в Blender 5.2, Cycles; результат — WebP в `src/renderer/src/reference/data/boardRenders.ts`, генерируется `scripts/boardart/build.mjs`). Сторонние модели, чертежи, фотографии и растровые рисунки не используются; логотипов и товарных знаков в рисунках нет (на шёлкографии — только названия плат и выводов). Лицензия рисунков — лицензия проекта (см. boardart-3D-models-NOTICE.txt). Blender (GPL) — только инструмент рендера, лицензия не распространяется на изображения; шрифт надписей — встроенный шрифт Blender (свободная лицензия).

Габариты, шаг, порядок выводов и расположение разъёмов и крупных деталей взяты из общедоступной документации производителей (Espressif, Arduino, Raspberry Pi, AI-Thinker, WeAct, STMicroelectronics): числа — факты. Подписи, цветовая разметка и интерактивность поверх рисунка — собственные.

**Происхождение координат выводов.** Для Uno, Nano, Mega 2560, Leonardo, Pro Mini, Pico, Pico W, Pico 2, Nucleo-64 и ряда других плат координаты выводов слоя были измерены по ранее использовавшимся рисункам. Сами рисунки из приложения удалены; осталась только таблица координат (`scripts/boardart/legacy_pins.json` — положения контактов в мм, то есть измеренные факты), поэтому ниже сохранены уведомления об авторстве исходных работ:

| Плата | Источник координат | Лицензия источника |
|---|---|---|
| Arduino Uno, Nano, Mega 2560 | пакет `@wokwi/elements` 1.9.2, https://github.com/wokwi/wokwi-elements, © 2020 Uri Shaked | MIT (текст — wokwi-elements-LICENSE.txt) |
| Arduino Leonardo, Arduino Pro Mini, STM32 Nucleo-64 | https://github.com/fritzing/fritzing-parts (файлы `*_breadboard.svg`, `.fzp`), © Fritzing; деталь Nucleo — fabian althaus | CC BY-SA 3.0 (fritzing-parts-LICENSE.txt, https://creativecommons.org/licenses/by-sa/3.0/) |
| Raspberry Pi Pico, Pico W, Pico 2 | официальные детали Fritzing от Raspberry Pi Ltd (см. даташиты https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf, /picow/pico-w-datasheet.pdf, /pico/pico-2-datasheet.pdf); авторы Pico — Alasdair Allan, Jack Wills (изменено vanepp) | разрешение Raspberry Pi («Permission to use, copy, modify, and/or distribute this design for any purpose with or without fee is hereby granted», raspberry-pi-design-files-NOTICE.txt); названия и логотип Raspberry Pi — товарные знаки Raspberry Pi Ltd, в рисунках не воспроизводятся |

Платы ESP32/ESP8266 (DevKit V1, DevKitC V4, S3, C3, SuperMini, NodeMCU, D1 mini) и STM32 (Blue Pill, Black Pill, Nucleo-32) моделировались и размечались сразу по документации производителей; готовых открытых 3D-моделей/KiCad-проектов этих плат с подходящей лицензией найти не удалось.

Данные о выводах STM32 (соответствие Arduino ↔ порт, функции ADC/ШИМ/I2C/SPI/UART/CAN/USB) получены из файлов `PeripheralPins.c` и `variant_*.h` ядра STM32duino (https://github.com/stm32duino/Arduino_Core_STM32, BSD-3-Clause, © STMicroelectronics) скриптом `scripts/build-stm32-funcs.mjs`; данные о Pico — из даташитов Raspberry Pi (факты о выводах). Данные не проверялись по PDF ST (сайт ST недоступен из среды разработки) — см. заметки плат.

Не использованы по лицензионным причинам: репозиторий https://github.com/wokwi/wokwi-boards (рисунки NodeMCU/ESP32-S3/C3 и др.) не содержит файла лицензии, то есть права не переданы. Файлов проектов плат Espressif (KiCad/STEP) в репозитории esp-dev-kits (Apache-2.0) найти не удалось.

### Платы, добавленные позже (данные о выводах и источники)

Рисунки — те же собственные 3D-модели (`scripts/boardart/boards3.py`). Данные (порядок выводов, имена, функции, номера) — факты из первоисточников, прочитанных при добавлении; сами схемы и изображения источников в приложение и в проект не включены:

| Плата | Источники |
|---|---|
| Arduino Nano Every, Nano 33 IoT, Nano ESP32, Micro, Zero | страницы https://docs.arduino.cc/hardware/ и официальные схемы распиновки `docs.arduino.cc/resources/pinouts/*-full-pinout.pdf` (CC BY-SA 4.0; использованы только факты о выводах) |
| Seeed XIAO ESP32C3 / ESP32S3 / RP2040 / SAMD21 | https://wiki.seeedstudio.com/ (таблицы и схемы распиновки Seeed), ядро arduino-esp32 `variants/XIAO_ESP32C3/pins_arduino.h` (LGPL-2.1) |
| ESP32-S2-DevKitM-1, ESP32-C6-DevKitC-1 | руководства Espressif https://docs.espressif.com/projects/esp-dev-kits/ |
| SparkFun Pro Micro | https://www.sparkfun.com/products/12640 и «Graphical Datasheet» SparkFun (CC BY-SA 4.0) |
| Teensy 4.0 | https://www.pjrc.com/teensy/pinout.html и карточка https://www.pjrc.com/teensy/card10a_rev2_web.pdf (PJRC) |

Габариты ESP32-S2-DevKitM-1, ESP32-C6-DevKitC-1, Arduino Micro, Teensy 4.0 и положение мелких деталей — приблизительные (в первоисточниках числа не найдены), это отмечено в заметках каждой платы.

### Вторая волна плат (данные и источники)

Рисунки — собственные 3D-модели (`scripts/boardart/boards4.py`, `boards5.py`). Использованы только факты о выводах из первоисточников; сами схемы и изображения источников в проект не включены:

| Плата | Источники |
|---|---|
| Adafruit Feather ESP32-S3, Feather RP2040, Feather M0 Express | PDF с распиновкой в репозиториях adafruit/Adafruit-Feather-ESP32-S3-PCB, -RP2040-PCB, -M0-Express-PCB (лицензии Adafruit — см. license.txt репозиториев); learn.adafruit.com |
| Wemos (Lolin) S2/S3/C3 Mini | картинки пинаута и страницы https://www.wemos.cc/en/latest/; arduino-esp32 `variants/lolin_*_mini/pins_arduino.h` (LGPL-2.1) |
| LILYGO TTGO T-Display | https://github.com/Xinyuan-LilyGO/TTGO-T-Display (`image/pinmap.jpg`) |
| Heltec WiFi LoRa 32 V3 | https://resource.heltec.cn/download/WiFi_LoRa_32_V3 (Wi-Fi_LoRa32_V3.2_Pinmap.png) |
| ESP-01S | спецификация Ai-Thinker ESP-01S V1.0 (зеркало static.chipdip.ru) |
| AI-Thinker ESP32-CAM | «ESP32-Cam Datasheet» AI-Thinker (копия cdn.shopify.com) |
| Arduino Due | docs.arduino.cc (A000056, CC BY-SA 4.0), ядро ArduinoCore-sam `variants/arduino_due_x/variant.cpp` (LGPL-2.1) |
| Teensy 4.1 | https://www.pjrc.com/teensy/pinout.html, card11a PDF |

