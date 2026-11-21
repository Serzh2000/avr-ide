// Заготовки файлов нового Pro-проекта (чистые функции: возвращают «путь → содержимое», запись на диск делает main).
import { defaultProject, linkerPathOf, startupPathOf } from './presets'
import type { ProPreset } from './presets'
import { generateLinkerScript } from '../build/linkerGen'
import { serializeProject } from './serialize'

export type ProTemplate = 'empty' | 'blink'
export const PRO_TEMPLATES: { id: ProTemplate; title: string; hint: string }[] = [
  { id: 'blink', title: 'Мигание светодиодом', hint: 'Прямая работа с регистрами через CMSIS, без HAL' },
  { id: 'empty', title: 'Пустой проект', hint: 'Только main.c с подключением CMSIS-заголовка' }
]

const emptyMain = (p: ProPreset): string => `// Проект: пустой каркас. Кристалл ${p.chip}.
// CMSIS-заголовок устройства: определяет регистры (RCC, GPIOx …) и макросы битов.
#include "${p.header}"

int main(void)
{
    for (;;) {
    }
}
`

function blinkMain(p: ProPreset): string {
  const { port, pin, on, name } = p.led
  const gpio = `GPIO${port}`
  let init: string
  if (p.series === 'F1') {
    const reg = pin < 8 ? 'CRL' : 'CRH'
    const sh = (pin % 8) * 4
    init = `    RCC->APB2ENR |= RCC_APB2ENR_IOP${port}EN;      // тактирование порта ${port}
    (void)RCC->APB2ENR;                              // дождаться включения тактирования
    // Режим вывода: MODE = 10 (2 МГц), CNF = 00 (двухтактный выход общего назначения)
    ${gpio}->${reg} = (${gpio}->${reg} & ~(0xFu << ${sh})) | (0x2u << ${sh});`
  } else {
    const bus = p.series === 'F4' ? 'AHB1ENR' : p.series === 'F3' || p.series === 'L1' ? 'AHBENR' : 'AHB2ENR'
    init = `    RCC->${bus} |= RCC_${bus}_GPIO${port}EN;       // тактирование порта ${port}
    (void)RCC->${bus};                                // дождаться включения тактирования
    // Режим вывода: MODER = 01
    ${gpio}->MODER = (${gpio}->MODER & ~(3u << ${pin * 2}u)) | (1u << ${pin * 2}u);`
  }
  const lit = on === 'low' ? `${gpio}->BSRR = (1u << (${pin} + 16u))` : `${gpio}->BSRR = (1u << ${pin}u)`
  const dark = on === 'low' ? `${gpio}->BSRR = (1u << ${pin}u)` : `${gpio}->BSRR = (1u << (${pin} + 16u))`
  return `// Мигание светодиодом ${name} (${p.board}, ${p.chip}). Светодиод включается ${on === 'low' ? 'низким' : 'высоким'} уровнем.
// Работа напрямую с регистрами через CMSIS. Задержка — пустой цикл: частота не настроена, ядро работает от внутреннего генератора.
#include "${p.header}"
#include <stdint.h>

static void delay(volatile uint32_t n)
{
    while (n--) {
    }
}

int main(void)
{
${init}

    for (;;) {
        ${lit};
        delay(400000u);
        ${dark};
        delay(400000u);
    }
}
`
}

/** Метка заготовки startup: пока она в файле, сборка просит скачать пакет поддержки чипа (CMSIS ST) и заменяет файл настоящим. */
export const STARTUP_PLACEHOLDER = 'AVRIDE-PLACEHOLDER'
const startupStub = (p: ProPreset): string => `/* ${STARTUP_PLACEHOLDER}: заготовка файла запуска (startup) для ${p.chip}.
   Настоящий файл (${p.startup}) берётся из репозитория ST cmsis-device (Apache-2.0): нажмите «Собрать» и подтвердите
   скачивание пакета поддержки чипа — IDE проверит файлы по контрольным суммам и подставит их в проект. */
`

export function scaffoldFiles(name: string, p: ProPreset, template: ProTemplate): Record<string, string> {
  const project = defaultProject(name, p)
  return {
    'avride.project.json': serializeProject(project),
    'src/main.c': template === 'blink' ? blinkMain(p) : emptyMain(p),
    'include/README.txt': 'Заголовочные файлы проекта.\nЭта папка указана в includes файла avride.project.json.\n',
    [startupPathOf(p)]: startupStub(p),
    [linkerPathOf(p)]: generateLinkerScript(project.target.memory, { chip: p.chip }),
    '.gitignore': '# Результаты сборки\nbuild/\n*.o\n*.elf\n*.bin\n*.hex\n*.map\n',
    'README.md': `# ${name}

Проект для ${p.board} (${p.chip}), профессиональный режим AVR IDE.

- \`avride.project.json\` — описание проекта: кристалл, память, исходники, конфигурации Debug и Release, программатор (ST-Link, SWD).
- \`src/\` — исходники, \`include/\` — заголовки, \`startup/\` и \`linker/\` — файл запуска и скрипт компоновщика.

Сборка: кнопка «Собрать» (Ctrl+B) в шапке. Файлы CMSIS (\`drivers/\`, \`startup/\`) IDE скачивает из репозиториев ST по вашему подтверждению и проверяет по контрольным суммам; скрипт компоновки \`linker/\` создан по карте памяти чипа и его можно править.
Вне IDE проект собирается через «Экспорт сборки» (Makefile и CMakeLists.txt).
`
  }
}

/** Имя проекта → папка и main-файл: те же правила, что у скетчей (латиница, цифры, «_» и «-»), см. files/naming.ts. */
export const MAIN_FILE = 'src/main.c'
