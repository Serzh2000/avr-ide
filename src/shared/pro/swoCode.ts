// Код «printf через SWO/ITM» для проектов Cortex-M3/M4/M7/M33 (у Cortex-M0 и M0+ блока ITM нет). Используется шаблоном проекта «printf через SWO»
// и сниппетом редактора. Основа — CMSIS: ITM_SendChar() из core_cmX.h (стимул-порт 0), регистры CoreDebug->DEMCR и ITM->{LAR,TCR,TER}.
// Вывод принимает вкладка «SWO» (OpenOCD: tpiu + itm port 0 on).
import type { CoreKind } from '../../main/pro/project/types'

/** У Cortex-M0 и M0+ нет ITM/SWO-трассировки инструкций: шаблон для них недоступен. */
export const coreHasItm = (core: CoreKind): boolean => core !== 'cortex-m0' && core !== 'cortex-m0plus'

/** Код инициализации и перенаправления printf (newlib-nano: _write вызывается из printf/puts/putchar). */
export const SWO_SUPPORT_C = `/* printf через SWO: каждый символ уходит в стимул-порт 0 блока ITM (CMSIS ITM_SendChar). */
static void swo_init(void)
{
    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;    /* включить блоки трассировки (DWT, ITM) */
    ITM->LAR = 0xC5ACCE55u;                             /* разблокировать ITM (нужно на Cortex-M7, на других безвредно) */
    ITM->TCR |= ITM_TCR_ITMENA_Msk;                     /* включить ITM */
    ITM->TER |= 1u;                                     /* разрешить порт 0 */
}

int _write(int fd, char *ptr, int len)
{
    (void)fd;
    for (int i = 0; i < len; i++) {
        ITM_SendChar((uint32_t)(unsigned char)ptr[i]);  /* ждёт, пока в порту есть место */
    }
    return len;
}
`

export function swoMainC(header: string, chip: string, board: string): string {
  return `// printf через SWO (${board}, ${chip}). Откройте вкладку «SWO» внизу, нажмите «Запустить» и прошейте плату.
// Нужен вывод SWO программатора, соединённый с выводом SWO микроконтроллера (обычно PB3). Частота ядра в проекте должна совпадать с настоящей:
// в этом примере тактирование не настраивается, ядро работает от внутреннего генератора — укажите в поле «Частота ядра» вкладки «SWO» его частоту.
#include "${header}"
#include <stdint.h>
#include <stdio.h>

${SWO_SUPPORT_C}
static void delay(volatile uint32_t n)
{
    while (n--) {
    }
}

int main(void)
{
    swo_init();
    setvbuf(stdout, NULL, _IONBF, 0);   /* без буфера: строка уходит сразу, а не по заполнении */

    uint32_t n = 0;
    for (;;) {
        printf("SWO работает: счётчик = %lu\\r\\n", (unsigned long)n++);
        delay(400000u);
    }
}
`
}
