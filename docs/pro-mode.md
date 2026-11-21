# Профессиональный режим

Режим разработки как в Keil или STM32CubeIDE: настоящий ARM-проект без обвязки Arduino (C/C++, CMSIS, startup, скрипт компоновщика, конфигурации Debug и Release), прошивка и отладка через ST-Link. Режим Arduino остаётся как есть. Этот документ описывает фундамент (этап A); сборка, прошивка, база чипов и редактор подключаются отдельными этапами через интерфейсы ниже.

## Этапы

| Этап | Что делает | Где подключается |
|------|-----------|------------------|
| A | модель проекта, режим в интерфейсе, мастер, заглушки | `src/main/pro/`, `src/renderer/src/pro/` |
| B | сборка arm-none-eabi-gcc | `proRegistry.register('build', …)` |
| C | прошивка, GDB-сервер, отладка (ST-Link, OpenOCD) | `register('programmer', …)`, `register('debug', …)` |
| D | база чипов (выводы, память, файлы CMSIS) | `register('chips', …)`; мастер и панель «Чипы и платы» берут данные оттуда |
| E | редактор и CubeMX-подобный конфигуратор | поверх `ChipDatabase` и `avride.project.json` |

## Режим в приложении

- Настройка `proMode` хранится в `localStorage` (`avride.pro.v1`, модуль `pro/proStore.ts`). По умолчанию Arduino.
- Переключатель «Arduino | Профессиональный»: стартовый экран, шапка, «Настройки → Режим работы».
- Открытие папки с `avride.project.json` включает Pro-режим, любой другой проект — режим Arduino; в обоих случаях показывается уведомление.
- Шапка Pro: «Собрать», «Прошить», «Отладка», «Конфигурация: Debug», «Цель: STM32F103C8», «Программатор: ST-Link». Кнопки неактивны, пока соответствующий провайдер не реализован (`ProviderInfo.implemented`), и объясняют это подсказкой; сами включатся, когда этап зарегистрирует провайдер.
- Боковая панель Pro: Файлы, Поиск, Проект (Исходники, Заголовки, Startup, Скрипт компоновщика, Документы, Конфигурации, Цель), Чипы и платы, Настройки. Платы, Библиотеки, Примеры, ESPUI и Веб-сайт скрыты. Монитор порта и плоттер скрыты в нижней панели.
- Ctrl+B и Ctrl+U в Pro-режиме вызывают `runProAction('build' | 'flash')`.

## Файл проекта `avride.project.json` (схема 1)

```json
{
  "schemaVersion": 1,
  "name": "BluePillBlink",
  "target": {
    "vendor": "st",
    "family": "STM32F1",
    "chip": "STM32F103C8T6",
    "board": "Blue Pill",
    "core": "cortex-m3",
    "clock": { "hseHz": 8000000, "sysclkHz": 72000000 },
    "memory": {
      "flash": { "origin": "0x08000000", "size": 65536 },
      "ram": { "origin": "0x20000000", "size": 20480 }
    }
  },
  "sources": ["src"],
  "includes": ["include"],
  "defines": ["STM32F103xB"],
  "linkerScript": "linker/STM32F103C8T6_FLASH.ld",
  "startupFile": "startup/startup_stm32f103xb.s",
  "configurations": {
    "Debug": { "optimization": "Og", "debugLevel": "g3", "defines": ["DEBUG"], "extraFlags": [] },
    "Release": { "optimization": "Os", "debugLevel": "none", "defines": ["NDEBUG"], "extraFlags": [] }
  },
  "toolchain": { "kind": "arm-none-eabi-gcc" },
  "programmer": { "kind": "stlink", "interface": "swd", "openocdTarget": "target/stm32f1x.cfg" }
}
```

Правила:

- Пути относительные, с разделителем `/`, без `..` и диска. `sources` и `includes` — файлы или папки (папки обходятся рекурсивно).
- Адреса памяти — hex-строки `0x…`, размеры — байты. `target.memory.extra` — необязательные области (`name`, `origin`, `size`: CCM, SRAM2).
- Необязательные поля: `target.board`, `target.fpu` (`fpv4-sp-d16`, `fpv5-d16`, `fpv5-sp-d16`), `target.floatAbi` (`soft`, `softfp`, `hard`), `target.clock`, `svd`, `toolchain.version`, `programmer.openocdTarget`.
- `core`: `cortex-m0`, `cortex-m0plus`, `cortex-m3`, `cortex-m4`, `cortex-m7`, `cortex-m33`. `optimization`: `O0 O1 O2 O3 Os Og Oz`. `debugLevel`: `none g1 g2 g3`. `programmer.kind`: `stlink`, `jlink`, `cmsis-dap`.
- Конфигурации Debug и Release обязательны, можно добавлять свои. Активная конфигурация в файл не пишется (это состояние интерфейса, `proStore.config`).
- Папка результатов сборки по соглашению `build/<Конфигурация>`.
- Неизвестные поля дают предупреждение и игнорируются; ошибки содержат путь к полю (`target.memory.flash.origin: …`).

### Код (`src/main/pro/project/`, без Electron, с тестами)

| Файл | Что внутри |
|------|-----------|
| `types.ts` | типы `ProProject`, `ProTarget`, `BuildConfiguration`…, `PROJECT_FILE`, `SCHEMA_VERSION` |
| `validate.ts` | `validateProject(raw)`, `isProjectPath`, `formatIssues` |
| `migrate.ts` | `migrateProject(raw, table?, latest?)`, таблица `MIGRATIONS` (цепочка N → N+1; сейчас пуста, схема одна) |
| `serialize.ts` | `parseProjectText(text)` (JSON → миграции → проверка), `serializeProject(p)` (стабильный порядок полей) |
| `presets.ts` | временный список кристаллов для мастера (`PRO_PRESETS`), `defaultProject(name, preset)` |
| `scaffold.ts` | `scaffoldFiles(name, preset, template)` → файлы нового проекта; шаблоны `blink` и `empty` |

Изменение схемы: поднять `SCHEMA_VERSION`, добавить `MIGRATIONS[старая]`, обновить валидатор и тесты.

## Интерфейсы провайдеров (`src/main/pro/interfaces.ts`)

Все методы асинхронные. У каждого провайдера есть `id` и `implemented`. Операции получают `ProjectContext { root, project, configuration }` и необязательные `RunOptions { onLog, signal }`.

- `BuildProvider` (B): `configure(ctx) → BuildPlan`, `build(ctx, opts?) → BuildResult`, `clean(ctx)`, `size(ctx) → SizeReport`, `map(ctx) → MapReport`.
- `ProgrammerProvider` (C): `listProbes() → Probe[]`, `flash(ctx, probe, {file, address?, verify?, reset?})`, `erase(ctx, probe, {mass?})`, `startGdbServer(ctx, probe) → {port, stop()}`.
- `DebugProvider` (C): `launch(ctx, probe) → DebugSession` (resume, pause, step*, breakpoints, stack, registers, memory, события).
- `ChipDatabase` (D): `getChip(id)`, `listChips(query?)`, `pinFunctions(chipId)`, `memoryMap(chipId)`.

Заглушки (`stubs.ts`) бросают `NotImplementedError` с русским текстом («Сборка ARM-проектов ещё не реализована…»), `isNotImplemented(e)` отличает их от настоящих ошибок.

### Регистрация

```ts
import { proRegistry } from './pro/registry'
proRegistry.register('build', myBuildProvider) // вызывать при старте main (рядом с registerProIpc)
```

`proRegistry.status()` отдаёт сводку `{build, programmer, debug, chips}: {id, implemented}`; интерфейс получает её через `window.api.pro.providers()` (читается при показе шапки).

### IPC (`src/main/pro/ipc.ts`, `window.api.pro`)

| Метод | Назначение |
|-------|-----------|
| `providers()` | сводка провайдеров |
| `readProject()` | `avride.project.json` открытой папки: `{found:false}`, `{found, ok:true, project}` или `{found, ok:false, error}` |
| `create(name, parent, chip, template)` | создаёт папку со структурой, открывает её в main; renderer затем вызывает `project.open` |
| `action(kind, configuration)` | `build`, `clean`, `flash`, `debug` через реестр; нереализованное возвращает понятную ошибку |

## Структура нового проекта

```
<имя>/
  avride.project.json
  src/main.c            (шаблон «Мигание светодиодом» через регистры CMSIS или пустой main)
  include/README.txt
  startup/<startup>.s   (заготовка с комментарием; наполнит этап B)
  linker/<чип>_FLASH.ld (заготовка с комментарием; наполнит этап B)
  .gitignore
  README.md
```

## Данные о чипах в мастере

Список в `presets.ts` временный (Blue Pill F103C8, Black Pill F411CE, Nucleo F401RE/F411RE/F446RE/F103RB/L432KC): объёмы Flash и RAM, имена макросов и startup-файлов взяты из даташитов и CMSIS ST, платы совпадают со справочником (`reference/data/boardsMcu.ts`, `boardsMore10.ts`). Этап D заменяет его на `ChipDatabase`.

## Тесты

- Юнит: `src/main/pro/project/project.test.ts` (валидатор, миграции, сериализация, шаблоны для всех пресетов), `src/main/pro/registry.test.ts`.
- e2e: `scripts/e2e/scenarios/w-pro-mode.mjs` (режим, мастер, структура на диске, шапка, панель, автопереключение, сохранение режима). Снимки обеих тем и двух ширин: `node scripts/e2e/shots-pro.mjs <папка>`.

## Прошивка и отладка (этап C)

Код: `src/main/pro/openocd/` (командные строки, разбор журналов, список ST-Link, запуск OpenOCD), `src/main/pro/debug/` (разбор GDB/MI, сессия, разбор SVD), `src/main/pro/tools/` (поиск программ `findTool` / `locateTool`, установка xPack OpenOCD), `src/main/pro/hardware.ts` (IPC `pro:*`), интерфейс `src/renderer/src/pro/{HwPanel,DebugPanel,hwStore}`.

- Поиск программ: переменная `AVRIDE_PRO_<OPENOCD|GDB|GCC>` → путь из настройки (`userData/pro-tools.json`) → `userData/pro-tools/**/bin` → STM32CubeIDE и xPack → PATH. Установка OpenOCD «одной кнопкой» скачивает xPack OpenOCD (релиз `v0.12.0-7`, Windows x64) только после подтверждения и сверяет SHA-256.
- Прошивка: `openocd -f interface/stlink.cfg -c "transport select hla_swd" [-c "adapter serial …"] -f target/<цель>.cfg -c "adapter speed 1800" -c "program {файл} [адрес] verify reset exit"`. Цель — `programmer.openocdTarget` проекта, иначе из базы чипов. Файл — `build/<Конфигурация>/<имя проекта>.elf` (или единственный .elf в папке).
- Отладка: OpenOCD как GDB-сервер + `arm-none-eabi-gdb --interpreter=mi3`, символы `-file-symbol-file`, подключение `-target-select extended-remote`. Запись во Flash — только кнопка «Загрузить программу в устройство…» с подтверждением; запись в регистры и память — только с подтверждением.
- Горячие клавиши: F5 начать/продолжить, F10 шаг, F11 внутрь, Shift+F11 наружу, Shift+F5 стоп, F9 точка останова.
- Тесты: юнит (`openocd/*.test.ts`, `debug/*.test.ts`, `tools/tools.test.ts`), e2e `y-pro-flash` и `z-pro-install` на имитаторах (`scripts/e2e/fakes`). Инструкция для проверки на плате: [pro-hardware-test.md](pro-hardware-test.md).
- Не сделано: SWO/ITM-вывод, J-Link и CMSIS-DAP, установка arm-none-eabi-gdb (её ставит этап «Сборка»).

## Сборка (этап B)

Кнопка «Собрать» (Ctrl+B) собирает выбранную конфигурацию встроенным сборщиком на Node: без make, ninja и CMake. Компилятор — `arm-none-eabi-gcc`.

### Как это работает

1. **Проверка** (`BuildProvider.preflight`). По порядку: есть ли скрипт компоновки, найден ли компилятор, есть ли настоящий startup и заголовки CMSIS (а не заготовка мастера), есть ли исходники. Чего не хватает — для того интерфейс показывает карточку с одним главным действием: «Создать по карте памяти», «Скачать и установить» компилятор, «Скачать и собрать» файлы CMSIS. После действия сборка продолжается сама.
2. **План** (`build/plan.ts`, `build/flags.ts`). Исходники — файлы и папки из `sources` (рекурсивно: `.c`, `.cpp`/`.cc`/`.cxx`, `.s`/`.S`) плюс `startupFile`. Ключи: `-mcpu`, `-mthumb`, `-mfpu`/`-mfloat-abi` по ядру и FPU проекта; `-O…` и `-g…` по конфигурации; `-ffunction-sections -fdata-sections -Wall`; `-D` из проекта, конфигурации и макрос устройства из базы чипов; `-I` из `includes`; для C `-std=gnu11`, для C++ `-std=gnu++17 -fno-exceptions -fno-rtti -fno-threadsafe-statics`, для ассемблера `-x assembler-with-cpp`. Компоновка: `-T <скрипт> -Wl,-Map,--cref -Wl,--gc-sections -Wl,--print-memory-usage --specs=nano.specs --specs=nosys.specs -static`, объекты через файл ответов, `-Wl,--start-group -lc -lm -Wl,--end-group`; при наличии C++ компонует `arm-none-eabi-g++`. Свои ключи конфигурации (`extraFlags`): `-Wl,…`, `-l…`, `-L…`, `-T…`, `--specs=…` уходят компоновщику, остальные — компилятору (`-m…`, `-flto` — обоим). Пути в командах абсолютные с «/»: gcc печатает их в сообщениях, и клик по строке в «Проблемах» открывает файл.
3. **Инкрементальность** (`build/incremental.ts`). Файл перекомпилируется, если нет объекта, изменился хэш команды (любой ключ), исходник или любой заголовок из `.d` (формат make, `-MMD -MP`) новее объекта. Компоновка — если что-то пересобрано, нет ELF, изменился скрипт или хэш команды линковки. Состояние — `build/<Конфигурация>/.avride-state.json`.
4. **Параллельность.** Число потоков — по числу ядер процессора; после первой ошибки новые файлы не запускаются, уже идущие дорабатывают и все их сообщения попадают в «Проблемы».
5. **Результат.** `build/<Конфигурация>/<имя>.elf`, `.bin`, `.hex` (`arm-none-eabi-objcopy`), `.map`; `arm-none-eabi-size` (text/data/bss); использование областей — из таблицы, которую печатает ld (`--print-memory-usage`), разбор `.map` дополняет её секциями и крупнейшими символами (`build/mapParse.ts`). В строке состояния Pro: «Собрано · Flash 12,4 КБ (19%) · RAM 2,1 КБ (10%)»; Flash = text + data, RAM = data + bss (в таблице областей RAM — как у ld, с резервом под кучу и стек). Переполнение области: ошибка «Область памяти FLASH переполнена на N байт».
6. **Вкладка «Размер»** (нижняя панель): полоски Flash/RAM/CCMRAM… с процентами (цвет и подпись: «почти заполнено», «переполнение»), таблица секций, таблица самых больших символов с файлами.

### Компилятор

Порядок поиска (`build/toolchain.ts`, `toolchainStore.ts`): переменная `AVRIDE_PRO_GCC` (файл gcc или папка bin) → путь из настроек (Настройки → Режим работы → «Компилятор ARM», общий файл `userData/pro-tools.json` с этапом C) → установленный приложением (`userData/pro-tools/*/bin`) → PATH → Arm GNU Toolchain в Program Files → STM32CubeIDE (`C:\ST\…\gnu-tools-for-stm32…\tools\bin`) → xPack (`%APPDATA%\xPacks`). Каждый кандидат проверяется запуском `--version`.

Установка «одной кнопкой» (только Windows x64): xPack GNU Arm Embedded GCC 14.2.1-1.1 с GitHub (308 МБ, ≈ 1,7 ГБ на диске). Карточка перед скачиванием показывает размер, источник, проверку SHA-256 и лицензию; ход виден в строке прогресса и в «Выводе»; отмена убивает скачивание и распаковку. Сумма записана в коде и сверяется после скачивания (несовпадение — архив удаляется, установка прекращается). Распаковка штатным `tar.exe` Windows. Лицензии и ссылки на исходники — в `licenses/THIRD_PARTY.md`. В той же папке `pro-tools` этап C находит `arm-none-eabi-gdb`.

### Файлы поддержки чипа

Мастер создаёт проект, который собирается после одного подтверждения:

- `linker/<чип>_FLASH.ld` — **генерируется** (`build/linkerGen.ts`) по карте памяти проекта: области FLASH и RAM, дополнительные (CCMRAM и др.) со своими секциями `.ccmram`; соседние области базы (SRAM1+SRAM2, банки Flash) сливаются, основная RAM — самая большая (у H743 — AXI SRAM). Кнопка «Создать по карте памяти» (`pro:generate-linker`) воссоздаёт утерянный скрипт.
- `startup/startup_*.s`, `drivers/CMSIS/Include/*` (ядро), `drivers/CMSIS/Device/ST/STM32F1xx/{Include,Source}/*` — **скачиваются** из репозиториев ST (`cmsis-device-*`, `cmsis_core`, Apache-2.0) по тегам. Манифест `src/main/pro/support/manifest.ts` (генерируется `scripts/build-cmsis-manifest.mjs`) хранит для каждого файла путь, размер и git-SHA-1; адрес — неизменяемый коммит тега. Скачивание — только после подтверждения (источник, размер, лицензия), каждый файл сверяется, кэш лежит в `userData/pro/support`. Если в кэше уже всё есть, мастер копирует файлы в проект сразу, без сети.
- Для чипа, которого нет в базе, пакета поддержки нет: добавьте startup и заголовки вручную.

### Экспорт сборки

«Экспорт сборки…» (панель «Проект», вкладка «Размер», палитра команд) пишет в корень проекта `Makefile` (GNU make: `make`, `make CONFIG=Release`, `make clean`) и `CMakeLists.txt` (CMake 3.20+, Ninja или make). Ключи те же, что у встроенного сборщика. Файлы начинаются со строки «# Создан AVR IDE»; чужие файлы с такими именами заменяются только после подтверждения.

### Конфигурации

Панель «Проект» → «Конфигурации» → «Изменить…» (или палитра команд): оптимизация (`-O0 … -Oz`), отладочная информация (`-g1 … -g3`), макросы `-D`, дополнительные ключи; можно добавить свою конфигурацию (копия выбранной) и удалить свою. Запись — в `avride.project.json` (`pro:save-project`, с проверкой схемы).

### Код и IPC

| Файл | Что внутри |
|------|-----------|
| `src/main/pro/build/flags.ts`, `plan.ts` | ключи gcc, план: задания компиляции и компоновки, хэши команд |
| `build/incremental.ts`, `depfile.ts` | что пересобирать, пул заданий, разбор `.d` |
| `build/provider.ts` | `ArmGccBuildProvider` (`BuildProvider`): `configure`, `build`, `clean`, `size`, `map`, плюс `preflight`, `report` |
| `build/mapParse.ts`, `diagnostics.ts` | `.map`, вывод `size`, таблица ld, сообщения gcc → `Diagnostic` |
| `build/linkerGen.ts`, `exportBuild.ts` | скрипт компоновки, Makefile и CMakeLists |
| `build/toolchain.ts`, `toolchainStore.ts` | поиск и установка компилятора |
| `src/main/pro/support/` | манифест CMSIS, скачивание, проверка, копирование в проект |
| `build/ipc.ts` | `pro:toolchain*`, `pro:preflight`, `pro:support*`, `pro:build`, `pro:build-cancel`, `pro:clean`, `pro:report`, `pro:generate-linker`, `pro:export-build`, `pro:save-project` |
| `src/renderer/src/pro/buildStore.ts`, `BuildDialogs.tsx`, `ConfigDialog.tsx`, `SizePanel.tsx`, `build.css` | состояние и интерфейс |

Долгие операции идут в тех же событиях `cli:log` / `cli:done`, что и операции Arduino-режима (`kind: 'compile'` для сборки), ход — `pro:progress`; поэтому «Вывод», «Проблемы» и строка состояния работают общим кодом. Проверка окружения для автотестов (`AVRIDE_E2E=1`): `AVRIDE_PRO_GCC=none` — компилятора «нет», `AVRIDE_PRO_TOOLCHAIN_URL` — адрес архива вместо GitHub (локальный сервер).

### Тесты этапа B

- Юнит: `src/main/pro/build/build.test.ts` (ключи, план, инкрементальность, пул, `.d`, `.map`, `size`, сообщения gcc, скрипт компоновки по картам памяти F103/G474/F407/H743, экспорт, шаблоны мастера), `toolchain.test.ts` (поиск на подменённой ОС), `src/main/pro/support/support.test.ts` (манифест для 16 чипов, git-SHA-1, подменённая сеть, копирование).
- e2e: `x-pro-build.mjs` — состояния интерфейса без компилятора (карточка установки, отказ при неверной сумме на локальном сервере, настройки, «Размер», конфигурации, экспорт, скрипт компоновки, обе темы, ширина 760); `xf-pro-build-full.mjs` [full] — настоящая сборка F103C8, F411RE, G474RE (нужен компилятор: `AVRIDE_E2E_GCC=<папка bin>` и интернет для CMSIS): `.elf`/`.bin`/`.hex`, SP и вектор Reset в диапазоне чипа, «Размер», повторная сборка без работы, Release, ошибка в «Проблемах» и переход к строке.

### Что не проверено

- Установка компилятора с настоящего GitHub «кнопкой» (300 МБ) в автотестах не прогоняется: проверены скачивание на локальном сервере с неверной суммой, SHA-256 архива и распаковка вручную (`tar.exe`), сборка локально распакованным компилятором.
- Экспортированные `Makefile` и `CMakeLists.txt` сгенерированы и проверены только чтением: GNU make и CMake на тестовой машине нет.
- Чипы вне 16 из базы и серии F7, L5, U5, WB, WL (нет в базе); Cortex-M33 только в таблице ключей и манифесте ядер.
- Запуск программы на плате: сборка не прошивает устройство.
