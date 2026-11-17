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

Рисунки вставляются в приложение как отдельные векторные ресурсы (`src/renderer/src/reference/data/boardArt.ts`, генерируются `scripts/build-board-art.mjs`); подписи, цветовая разметка и интерактивность поверх рисунка — собственные. Координаты выводов взяты из тех же источников.

| Плата | Источник | Лицензия | Требования |
|---|---|---|---|
| Arduino Uno, Nano, Mega 2560, ESP32 DevKit V1 (30 pin) | пакет `@wokwi/elements` 1.9.2, https://github.com/wokwi/wokwi-elements, © 2020 Uri Shaked | MIT (текст — wokwi-elements-LICENSE.txt) | сохранить уведомление об авторских правах и текст лицензии (приложены); разметка SVG использована без изменений, кроме подстановки статических значений |
| Arduino Leonardo, Arduino Pro Mini, WeMos D1 mini | https://github.com/fritzing/fritzing-parts (файлы `*_breadboard.svg` и `.fzp`), © Fritzing | CC BY-SA 3.0 (см. fritzing-parts-LICENSE.txt, https://creativecommons.org/licenses/by-sa/3.0/) | указание авторства (выводится в справочнике под рисунком и здесь); производные рисунки распространяются на тех же условиях CC BY-SA 3.0 — рисунки в приложении не изменялись и остаются отдельными файлами данных, код приложения лицензией CC BY-SA не затрагивается |
| STM32 Nucleo-64 (NUCLEO-F401RE) | https://github.com/fritzing/fritzing-parts (деталь «STM32 Nucleo boards», файл `STM32_Nucleo_board_breadboard.svg`), © Fritzing, автор детали fabian althaus | CC BY-SA 3.0 | указание авторства (в справочнике под рисунком и здесь); из рисунка удалены надписи Arduino-разъёмов (поверх рисуются собственные подписи), масштаб схемы ×1.7 — рисунок изменён, оставаясь на условиях CC BY-SA 3.0 |
| Raspberry Pi Pico, Pico W, Pico 2 | официальные детали Fritzing от Raspberry Pi Ltd (файлы Pico-R3-Fritzing, PicoW-Fritzing, Pico-2-Fritzing, см. раздел 1.1 даташитов https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf, /picow/pico-w-datasheet.pdf, /pico/pico-2-datasheet.pdf); автор Pico — Alasdair Allan, Jack Wills (изменено vanepp) | разрешение Raspberry Pi: «Permission to use, copy, modify, and/or distribute this design for any purpose with or without fee is hereby granted» (ISC-подобное, текст — raspberry-pi-design-files-NOTICE.txt) | сохранить текст разрешения и отказ от гарантий (приложены); рисунки встроены без изменений. Названия и логотип Raspberry Pi — товарные знаки Raspberry Pi Ltd. Сами даташиты распространяются по CC BY-ND 4.0 и в приложение не включены, использованы как источник данных о выводах |
| Blue Pill, Black Pill (WeAct), Nucleo-32 (NUCLEO-L432KC) | собственная отрисовка (scripts/build-board-art.mjs) | собственная, лицензия проекта | рисунки схематичные (расположение мелких деталей приблизительное); логотипов и товарных знаков не содержат |

Данные о выводах STM32 (соответствие Arduino ↔ порт, функции ADC/ШИМ/I2C/SPI/UART/CAN/USB) получены из файлов `PeripheralPins.c` и `variant_*.h` ядра STM32duino (https://github.com/stm32duino/Arduino_Core_STM32, BSD-3-Clause, © STMicroelectronics) скриптом `scripts/build-stm32-funcs.mjs`; данные о Pico — из даташитов Raspberry Pi (факты о выводах). Данные не проверялись по PDF ST (сайт ST недоступен из среды разработки) — см. заметки плат.

Не использованы по лицензионным причинам: репозиторий https://github.com/wokwi/wokwi-boards (рисунки NodeMCU/ESP32-S3/C3 и др.) не содержит файла лицензии, то есть права не переданы; платы NodeMCU v2/v3, ESP32 DevKitC V4, ESP32-S3-DevKitC-1, ESP32-C3 DevKitM-1 и C3 SuperMini нарисованы самостоятельно (упрощённо).
