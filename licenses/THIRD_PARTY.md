# Сторонние компоненты AVR IDE

| Компонент | Лицензия | Где используется |
|---|---|---|
| Electron | MIT (текст — LICENSE.electron.txt) | оболочка приложения |
| Monaco Editor | MIT | редактор кода |
| React, Zustand | MIT | интерфейс |
| ESPUI (фронтенд, s00500/ESPUI) | MIT, см. ESPUI-LICENSE.txt | живое превью конструктора ESPUI |
| arduino-cli (Arduino SA) | GPL-3.0 или коммерческая, см. arduino-cli-LICENSE.txt | сборка и прошивка; поставляется отдельным исполняемым файлом `arduino-cli.exe` рядом с приложением. Исходный код: https://github.com/arduino/arduino-cli |

Часть библиотек Arduino поставляется вместе с IDE и ставится в папку библиотек пользователя без интернета — см. раздел «Встроенные библиотеки». Остальные библиотеки пользователь скачивает через arduino-cli со своими лицензиями. Ядра AVR, ESP8266 и ESP32 с инструментами поставляются как «пакеты ядер» — см. раздел ниже.

## Встроенные библиотеки Arduino

Пакет собирает `npm run build:libs` (`scripts/build-lib-pack.mjs`) из официального индекса библиотек Arduino: архивы не изменяются, размер и SHA-256 проверяются при сборке и при установке. Они лежат в `resources/libs/`, тексты лицензий — в `resources/libs/licenses/<библиотека>/`. Версии записаны в `resources/libs/manifest.json`.

| Библиотека | Лицензия | Исходный код |
|---|---|---|
| ESPUI (s00500) | MIT | https://github.com/s00500/ESPUI |
| ESP Async WebServer (ESP32Async) | LGPL-3.0 | https://github.com/ESP32Async/ESPAsyncWebServer |
| Async TCP (ESP32Async) | LGPL-3.0 | https://github.com/ESP32Async/AsyncTCP |
| ESP Async TCP (ESP32Async) | LGPL-3.0 | https://github.com/ESP32Async/ESPAsyncTCP |
| RPAsyncTCP | LGPL-3.0 | https://github.com/ayushsharma82/RPAsyncTCP |
| ArduinoJson (Benoît Blanchon) | MIT | https://github.com/bblanchon/ArduinoJson |

LGPL-библиотеки подключаются к скетчу пользователя как отдельные файлы исходного кода в его папке библиотек, архивы поставляются без изменений; пользователь может заменить любую из них своей версией.

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

### Третья волна плат (данные и источники)

Рисунки — собственные 3D-модели (`scripts/boardart/boards6.py`, `boards7.py`). Использованы только факты о выводах из первоисточников; сами схемы и изображения источников в проект не включены:

| Плата | Источники |
|---|---|
| Arduino Uno R4 Minima / WiFi, Nano RP2040 Connect, MKR WiFi 1010 | docs.arduino.cc: официальные схемы распиновки `ABX00080`, `ABX00087`, `ABX00053`, `ABX00023` (CC BY-SA 4.0; использованы только факты о выводах) |
| Arduino Mini 05 | docs.arduino.cc/retired/boards/arduino-mini-05 (рисунок распиновки из веб-архива) |
| Seeed XIAO nRF52840, XIAO ESP32C6 | https://wiki.seeedstudio.com/ (таблицы и схемы распиновки Seeed) |
| Adafruit ItsyBitsy RP2040, QT Py RP2040 | PDF с распиновкой в репозиториях adafruit/Adafruit-ItsyBitsy-RP2040-PCB и adafruit/Adafruit-QT-Py-RP2040-PCB (лицензии Adafruit — см. репозитории) |
| Teensy 3.2 | https://www.pjrc.com/teensy/pinout.html и карточка card7a (PJRC) |
| Raspberry Pi Pico 2 W | даташит Pico 2 W (Raspberry Pi Ltd); название и логотип Raspberry Pi — товарные знаки Raspberry Pi Ltd, в рисунках не воспроизводятся |
| Waveshare RP2040-Zero, ESP32-S3-Zero | https://www.waveshare.com/wiki/ (картинки пинаута и чертежи размеров Waveshare) |

Габариты Uno R4, MKR WiFi 1010, ItsyBitsy RP2040, QT Py RP2040, Teensy 3.2 и Arduino Mini — приблизительные (в источниках не указаны явно), положение мелких деталей приблизительное; отмечено в заметках каждой платы.

### Четвёртая волна плат (данные и источники)

Рисунки — собственные 3D-модели (`scripts/boardart/boards8.py`, `boards9.py`). Использованы только факты о выводах из первоисточников; сами схемы и изображения источников в проект не включены:

| Плата | Источники |
|---|---|
| ESP32-C3-DevKitC-02, ESP32-S3-DevKitM-1, ESP8684-DevKitM-1, ESP32-H2-DevKitM-1 | руководства Espressif https://docs.espressif.com/projects/esp-dev-kits/ (таблицы Header Block) |
| Teensy LC | https://www.pjrc.com/teensy/pinout.html и карточка card6a (PJRC) |
| Adafruit ItsyBitsy M0 Express, ItsyBitsy nRF52840, Trinket M0 | PDF с распиновкой в репозиториях adafruit/Adafruit-ItsyBitsy-M0-PCB, -ItsyBitsy-nRF52840-Express-PCB, -Trinket-M0-PCB (лицензии Adafruit — см. репозитории) |
| NodeMCU-32S | «NodeMCU-32 Specification V1.3» Ai-Thinker (копия cdn.zbotic.in) |
| Arduino Nano Matter | docs.arduino.cc, схема распиновки ABX00112 (CC BY-SA 4.0; использованы только факты о выводах) |
| WeAct Studio RP2040 | https://github.com/WeActStudio/WeActStudio.RP2040CoreBoard (каталог HDK: PINout.PNG и чертёж размеров) |

Габариты плат Espressif DevKitM / DevKitC-02, ItsyBitsy, Trinket M0, NodeMCU-32S (размер в спецификации — сетка выводов), Teensy LC, WeAct (расстояние между рядами) — приблизительные; отмечено в заметках плат.

### Пятая волна плат (данные и источники)

Рисунки — собственные 3D-модели (`scripts/boardart/boards10.py`, `boards11.py`). Использованы только факты о выводах; сами схемы в проект не включены:

| Плата | Источники |
|---|---|
| Adafruit QT Py ESP32-S3 / S2 / C3, Feather M4 Express, ItsyBitsy M4 Express, Metro M4 Express, Metro M0 Express, Metro ESP32-S3, KB2040 | PDF с распиновкой в репозиториях adafruit/Adafruit-*-PCB (лицензии Adafruit — см. репозитории) |
| LILYGO T-Display-S3 | https://github.com/Xinyuan-LilyGO/T-Display-S3 (`image/T-DISPLAY-S3.jpg`) |
| Heltec Wireless Stick Lite V3 | https://resource.heltec.cn/download/Wireless_Stick_Lite_V3 (HTIT-WSL_V3.png) |

Габариты T-Display-S3 и Wireless Stick Lite V3 оценены по масштабу рисунков; отмечено в заметках плат.

### Пятая волна, продолжение (данные и источники)

Рисунки — собственные 3D-модели (`scripts/boardart/boards12.py`, `boards13.py`). Использованы только факты о выводах:

| Плата | Источники |
|---|---|
| STM32 Nucleo-64 F411RE, F446RE, F103RB, L053R8, L476RG, G474RE, L152RE, F303RE; Nucleo-32 G431KB | файлы `variant_NUCLEO_*.cpp/.h` и `PeripheralPins.c` ядра STM32duino (https://github.com/stm32duino/Arduino_Core_STM32, BSD-3-Clause, © STMicroelectronics); функции выводов сгенерированы скриптом `scripts/boardart/stm32funcs-more.mjs` в `src/renderer/src/reference/data/stm32FuncsMore.ts` |
| Adafruit ESP32 Feather V2, Feather ESP32-S2, Feather nRF52840 Sense | PDF с распиновкой в репозиториях adafruit/Adafruit-ESP32-Feather-V2-PCB, -Feather-ESP32-S2-PCB, -Feather-nRF52840-Sense-PCB (лицензии Adafruit — см. репозитории) |

## База чипов STM32 для Профессионального режима (`src/shared/pro/chips/*.ts`)

Файлы сгенерированы скриптом `scripts/build-chipdb.mjs` из первоисточников, скачанных во временный каталог (в репозиторий сами источники не входят). Лицензии прочитаны в репозиториях.

| Что взято | Источник | Лицензия | Проверка |
|---|---|---|---|
| Корпуса, номера и имена выводов, сигналы, номера AF (файлы `mcu/*.xml` и `mcu/IP/GPIO-*_Modes.xml`), ядро, частота, объёмы Flash/RAM, список периферии, идентификатор кристалла | https://github.com/STMicroelectronics/STM32_open_pin_data (ветка master) | BSD-3-Clause, © 2020 STMicroelectronics (файл LICENSE в репозитории) | проверено: текст лицензии прочитан |
| Адреса памяти, макросы устройств (`STM32F103xB`…), наличие FPU, имена заголовков и файлов `startup_*.s` | https://github.com/STMicroelectronics/cmsis-device-f0, -f1, -f3, -f4, -g4, -h7, -l0, -l1, -l4 (`Include/*.h`, дерево `Source/Templates/gcc`) | Apache-2.0 (License.md / LICENSE.md в репозиториях) | проверено: текст лицензии прочитан; исходный текст заголовков в данные не копируется, берутся только числа и имена |
| Имена файлов SVD (`STM32F103.svd` и др.) | https://github.com/modm-io/cmsis-svd-stm32 (ветка main) | Apache-2.0 (по сведениям репозитория; SVD — файлы ST) | сами SVD в данные не включены, только имена файлов |
| Имена целевых файлов OpenOCD (`stm32f1x.cfg` и др.) | https://github.com/openocd-org/openocd (`tcl/target`) | GPL-2.0+ | берутся только имена файлов (проверено по HTTP-ответу 200); содержимое не копируется |
| Имена скриптов компоновщика (только F103RB, F303RE, F446RE, G431KB, G474RE, H743ZI) | примеры в https://github.com/STMicroelectronics/STM32CubeF1, F3, F4, G4, H7 | BSD-3-Clause / Apache-2.0 (по файлам) | берутся только имена файлов; у остальных чипов подтверждённого имени нет |
| Светодиод и кнопка плат (`src/shared/pro/boardFacts.ts`) | `variant_*.h` ядра STM32duino (https://github.com/stm32duino/Arduino_Core_STM32) | BSD-3-Clause, © STMicroelectronics | факты (имена выводов), текст не копируется |

Не использовано: документы UM на st.com не открывались (сведения о платах взяты только из перечисленных репозиториев) и пакеты Keil DFP (распространяются не через GitHub ST); SVD-имена взяты из зеркала modm, а не из оригинального пака Keil.


## Прошивка и отладка в Профессиональном режиме (этап C)

Эти программы **не входят в состав IDE и не распространяются вместе с ней**: IDE находит установленные копии или скачивает их на устройство пользователя только после его подтверждения.

| Программа | Откуда | Лицензия | Как используется |
|---|---|---|---|
| OpenOCD 0.12.0 (сборка xPack, релиз `v0.12.0-7`, архив `xpack-openocd-0.12.0-7-win32-x64.zip`) | https://github.com/xpack-dev-tools/openocd-xpack/releases (кнопка «Установить OpenOCD» в панели «Прошивка») | GPL-2.0 (OpenOCD, https://openocd.org; лицензия сборки xPack указана в её релизе — проверьте перед распространением) | скачивается по подтверждению пользователя в папку данных приложения (`pro-tools/openocd`), контрольная сумма SHA-256 берётся из файла `.sha` релиза и API GitHub и сверяется до распаковки; IDE запускает `openocd` как отдельный процесс (командная строка), в код IDE он не включён |
| arm-none-eabi-gdb | из набора ARM GNU Toolchain / STM32CubeIDE, установленного пользователем (его ставит этап «Сборка») | GPL-3.0 | запускается как отдельный процесс (`--interpreter=mi3`), в код IDE не включён |
| Файлы SVD микроконтроллеров STM32 | https://github.com/modm-io/cmsis-svd-stm32 (ветка main, `stm32f1/STM32F103.svd` и аналоги) | Apache-2.0 (по сведениям репозитория; SVD — файлы STMicroelectronics) | скачиваются по подтверждению пользователя в папку данных приложения (`pro-svd`); разбираются собственным разборщиком, в репозиторий IDE не входят |

Дополнительно для J-Link, CMSIS-DAP и SWO (ничего из этого не входит в IDE и не устанавливается ею): интерфейсные файлы `interface/jlink.cfg` и `interface/cmsis-dap.cfg` входят в состав OpenOCD (GPL-2.0-or-later, libjaylink в составе сборки OpenOCD); драйвер SEGGER J-Link (проприетарный, https://www.segger.com) и утилита Zadig (WinUSB, GPL-3.0, https://zadig.akeo.ie) **только упоминаются как рекомендация в тексте подсказок**, IDE их не скачивает и не запускает. Значения USB VID/PID (SEGGER 1366 и PID из `contrib/60-openocd.rules` OpenOCD, Arm DAPLink 0D28:0204, Raspberry Pi Debug Probe 2E8A:000C) — публичные идентификаторы; код OpenOCD, SEGGER и Arm не копировался. SEGGER RTT не используется (исходники SEGGER RTT в проект не включены). Код шаблона «printf через SWO» — собственный, использует функцию CMSIS `ITM_SendChar` (Apache-2.0, © Arm Limited), которая скачивается пользователем вместе с файлами CMSIS этапа B.

Прочитаны только публичные описания протоколов: GDB/MI (GDB manual, «GDB/MI Output Syntax»), команды OpenOCD (OpenOCD User's Guide, openocd.org/doc), формат CMSIS-SVD (arm-software.github.io/CMSIS_5/SVD). Код GDB, OpenOCD и ST не копировался.


## Сборка проектов в Профессиональном режиме: компилятор и файлы CMSIS (этап B)

Ничего из перечисленного не входит в установщик IDE и не лежит в репозитории: всё скачивается по запросу пользователя (после подтверждения с размером, источником и контрольной суммой) в папку данных приложения.

| Что | Источник | Лицензия | Проверка |
|---|---|---|---|
| xPack GNU Arm Embedded GCC 14.2.1-1.1 (`arm-none-eabi-gcc`, binutils, newlib и newlib-nano, GDB), архив `xpack-arm-none-eabi-gcc-14.2.1-1.1-win32-x64.zip`, 323 368 593 байт. Ставится кнопкой «Установить компилятор ARM» в `userData/pro-tools/xpack-arm-none-eabi-gcc-14.2.1-1.1` | https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/tag/v14.2.1-1.1 (сборка xPack по исходным текстам Arm GNU Toolchain 14.2.Rel1; страница проекта https://xpack-dev-tools.github.io/arm-none-eabi-gcc-xpack/) | GPL-3.0-or-later (GCC, binutils, GDB, с исключением для библиотек времени выполнения), newlib — BSD-подобные лицензии и LGPL; полные тексты лежат в папке `distro-info/licenses` внутри архива | SHA-256 `0b2d496b383ba578182eb57b3f7d35ff510e36eda56257883b902fa07c3bba55` записана в коде (`src/main/pro/build/toolchain.ts`) и совпадает с файлом `.sha` рядом с архивом в релизе; при несовпадении архив удаляется |
| Исходные тексты компилятора (требование GPL) | скрипты и конфигурация сборки: https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack; исходные тексты GCC, binutils, newlib и GDB, из которых собран пакет, — на https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads (Arm GNU Toolchain 14.2.Rel1, раздел Source) и в репозиториях https://gcc.gnu.org, https://sourceware.org | GPL-3.0-or-later | IDE компилятор не распространяет: пользователь скачивает его напрямую с GitHub |
| Заголовки ядра CMSIS (`cmsis_compiler.h`, `cmsis_gcc.h`, `cmsis_version.h`, `core_cm0.h`/`cm0plus`/`cm3`/`cm4`/`cm7`/`cm33`, `mpu_armv7.h`, `mpu_armv8.h`, `tz_context.h`) | https://github.com/STMicroelectronics/cmsis_core, теги `v5.6.0_cm0`, `v5.6.0_cm3`, `v5.6.0_cm4`, `v5.6.0_cm7`, `v5.6.0_cm33` (коммиты — в `src/main/pro/support/manifest.ts`) | Apache-2.0 (© Arm Limited; SPDX-заголовки в файлах) | git-SHA-1 каждого файла из манифеста; адрес — неизменяемый коммит тега |
| Заголовки устройств, `system_*.c` и файлы запуска `startup_*.s` (по одному набору файлов на чип) | https://github.com/STMicroelectronics/cmsis-device-f0 (v2.3.8), -f1 (v4.3.5), -f3 (v2.3.9), -f4 (v2.6.12), -g4 (v1.2.6), -h7 (v1.10.8), -l0 (v1.9.4), -l1 (v2.3.4), -l4 (v1.7.5) | Apache-2.0 (© STMicroelectronics; файл лицензии копируется в проект рядом с заголовками) | git-SHA-1 каждого файла из манифеста (`scripts/build-cmsis-manifest.mjs` строит его по API GitHub); файлы скачиваются с `raw.githubusercontent.com` по коммиту тега и копируются в `drivers/CMSIS/` и `startup/` проекта пользователя |
| Скрипт компоновки GNU ld | генерируется IDE по карте памяти чипа из базы (`src/main/pro/build/linkerGen.ts`): стандартная раскладка секций из руководства GNU ld (`.isr_vector`, `.text`, `.rodata`, `.data` с загрузкой из Flash, `.bss`, резерв кучи и стека); имена символов (`_estack`, `_sidata`, `_sdata`, `_edata`, `_sbss`, `_ebss`) — те, что ожидают файлы запуска ST | собственный код IDE | текст скриптов STM32Cube не копируется |

Ключи компилятора (`-mcpu`, `-mfpu`, `-mfloat-abi`, `-ffunction-sections`, `--specs=nano.specs`, `-Wl,--gc-sections` и др.) взяты из документации GCC для ARM; сочетание FPU и ядра: Cortex-M4F — `fpv4-sp-d16`, Cortex-M7 с двойной точностью (STM32H743) — `fpv5-d16`.

Конфигуратор выводов и тактирования (`src/shared/pro/pinconfig/`) использует как справочные данные числа из драйверов HAL ST (stm32f1xx, stm32f4xx, stm32g4xx `_hal_driver`: допустимые значения PLL, предельные частоты шин, таблицы wait states) и примеров STM32Cube (проверочные значения): BSD-3-Clause, (c) STMicroelectronics. Код HAL в репозиторий и установщик не включается; HAL для режима «HAL» пользователь добавляет в проект сам.
