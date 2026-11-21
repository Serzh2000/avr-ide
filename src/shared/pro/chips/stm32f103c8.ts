// СГЕНЕРИРОВАНО scripts/build-chipdb.mjs — не править вручную.
// STM32F103C8T6: выводы и сигналы — STMicroelectronics/STM32_open_pin_data (BSD-3-Clause, © STMicroelectronics); память, макрос устройства, startup — cmsis-device-f1 (Apache-2.0).
/* eslint-disable */
import type { ChipRecord } from '../chipdb'

export const chip: ChipRecord = {
  id: "stm32f103c8", name: "STM32F103C8T6", family: "STM32F1", line: "STM32F103", core: "Cortex-M3", fpu: false, maxMHz: 72, dieId: "DIE410",
  flashKB: 64, ramKB: 20, voltage: [2,3.6], tempC: [-40,105],
  regions: [
    ["Flash",134217728,65536,"flash","адрес — CMSIS, объём — open-pin-data"],
    ["SRAM",536870912,20480,"ram","адрес — CMSIS, объём — open-pin-data"]
  ],
  packages: [
    { name: "LQFP48", part: "STM32F103C8Tx", pins: [
     ["1","VBAT","power","",[]],
     ["2","PC13","io","TAMPER-RTC",[["RTC_OUT",-1],["RTC_TAMPER",-1]]],
     ["3","PC14","io","OSC32_IN",[["RCC_OSC32_IN",-1]]],
     ["4","PC15","io","OSC32_OUT",[["ADC1_EXTI15",-1],["ADC2_EXTI15",-1],["RCC_OSC32_OUT",-1]]],
     ["5","PD0","io","OSC_IN",[["RCC_OSC_IN",-1]]],
     ["6","PD1","io","OSC_OUT",[["RCC_OSC_OUT",-1]]],
     ["7","NRST","reset","",[]],
     ["8","VSSA","power","",[]],
     ["9","VDDA","power","",[]],
     ["10","PA0","io","WKUP",[["ADC1_IN0",-1],["ADC2_IN0",-1],["SYS_WKUP",-1],["TIM2_CH1",-1],["TIM2_ETR",-1],["USART2_CTS",-1]]],
     ["11","PA1","io","",[["ADC1_IN1",-1],["ADC2_IN1",-1],["TIM2_CH2",-1],["USART2_RTS",-1]]],
     ["12","PA2","io","",[["ADC1_IN2",-1],["ADC2_IN2",-1],["TIM2_CH3",-1],["USART2_TX",-1]]],
     ["13","PA3","io","",[["ADC1_IN3",-1],["ADC2_IN3",-1],["TIM2_CH4",-1],["USART2_RX",-1]]],
     ["14","PA4","io","",[["ADC1_IN4",-1],["ADC2_IN4",-1],["SPI1_NSS",-1],["USART2_CK",-1]]],
     ["15","PA5","io","",[["ADC1_IN5",-1],["ADC2_IN5",-1],["SPI1_SCK",-1]]],
     ["16","PA6","io","",[["ADC1_IN6",-1],["ADC2_IN6",-1],["SPI1_MISO",-1],["TIM1_BKIN",-1,"TIM1_PARTIAL"],["TIM3_CH1",-1]]],
     ["17","PA7","io","",[["ADC1_IN7",-1],["ADC2_IN7",-1],["SPI1_MOSI",-1],["TIM1_CH1N",-1,"TIM1_PARTIAL"],["TIM3_CH2",-1]]],
     ["18","PB0","io","",[["ADC1_IN8",-1],["ADC2_IN8",-1],["TIM1_CH2N",-1,"TIM1_PARTIAL"],["TIM3_CH3",-1]]],
     ["19","PB1","io","",[["ADC1_IN9",-1],["ADC2_IN9",-1],["TIM1_CH3N",-1,"TIM1_PARTIAL"],["TIM3_CH4",-1]]],
     ["20","PB2","io","",[]],
     ["21","PB10","io","",[["I2C2_SCL",-1],["TIM2_CH3",-1,"TIM2_PARTIAL_2|TIM2_ENABLE"],["USART3_TX",-1]]],
     ["22","PB11","io","",[["ADC1_EXTI11",-1],["ADC2_EXTI11",-1],["I2C2_SDA",-1],["TIM2_CH4",-1,"TIM2_PARTIAL_2|TIM2_ENABLE"],["USART3_RX",-1]]],
     ["23","VSS","power","",[]],
     ["24","VDD","power","",[]],
     ["25","PB12","io","",[["I2C2_SMBA",-1],["SPI2_NSS",-1],["TIM1_BKIN",-1],["USART3_CK",-1]]],
     ["26","PB13","io","",[["SPI2_SCK",-1],["TIM1_CH1N",-1],["USART3_CTS",-1]]],
     ["27","PB14","io","",[["SPI2_MISO",-1],["TIM1_CH2N",-1],["USART3_RTS",-1]]],
     ["28","PB15","io","",[["ADC1_EXTI15",-1],["ADC2_EXTI15",-1],["SPI2_MOSI",-1],["TIM1_CH3N",-1]]],
     ["29","PA8","io","",[["RCC_MCO",-1],["TIM1_CH1",-1],["USART1_CK",-1]]],
     ["30","PA9","io","",[["TIM1_CH2",-1],["USART1_TX",-1]]],
     ["31","PA10","io","",[["TIM1_CH3",-1],["USART1_RX",-1]]],
     ["32","PA11","io","",[["ADC1_EXTI11",-1],["ADC2_EXTI11",-1],["CAN_RX",-1],["TIM1_CH4",-1],["USART1_CTS",-1],["USB_DM",-1]]],
     ["33","PA12","io","",[["CAN_TX",-1],["TIM1_ETR",-1],["USART1_RTS",-1],["USB_DP",-1]]],
     ["34","PA13","io","",[["SYS_JTMS-SWDIO",-1]]],
     ["35","VSS","power","",[]],
     ["36","VDD","power","",[]],
     ["37","PA14","io","",[["SYS_JTCK-SWCLK",-1]]],
     ["38","PA15","io","",[["ADC1_EXTI15",-1],["ADC2_EXTI15",-1],["SPI1_NSS",-1,"SPI1_ENABLE"],["SYS_JTDI",-1],["TIM2_CH1",-1,"TIM2_PARTIAL_1|TIM2_ENABLE"],["TIM2_ETR",-1,"TIM2_PARTIAL_1|TIM2_ENABLE"]]],
     ["39","PB3","io","",[["SPI1_SCK",-1,"SPI1_ENABLE"],["SYS_JTDO-TRACESWO",-1],["TIM2_CH2",-1,"TIM2_PARTIAL_1|TIM2_ENABLE"]]],
     ["40","PB4","io","",[["SPI1_MISO",-1,"SPI1_ENABLE"],["SYS_NJTRST",-1],["TIM3_CH1",-1,"TIM3_PARTIAL"]]],
     ["41","PB5","io","",[["I2C1_SMBA",-1],["SPI1_MOSI",-1,"SPI1_ENABLE"],["TIM3_CH2",-1,"TIM3_PARTIAL"]]],
     ["42","PB6","io","",[["I2C1_SCL",-1],["TIM4_CH1",-1],["USART1_TX",-1,"USART1_ENABLE"]]],
     ["43","PB7","io","",[["I2C1_SDA",-1],["TIM4_CH2",-1],["USART1_RX",-1,"USART1_ENABLE"]]],
     ["44","BOOT0","boot","",[]],
     ["45","PB8","io","",[["CAN_RX",-1,"CAN1_2"],["I2C1_SCL",-1,"I2C1_ENABLE"],["TIM4_CH3",-1]]],
     ["46","PB9","io","",[["CAN_TX",-1,"CAN1_2"],["I2C1_SDA",-1,"I2C1_ENABLE"],["TIM4_CH4",-1]]],
     ["47","VSS","power","",[]],
     ["48","VDD","power","",[]]
    ] }
  ],
  peripherals: ["ADC1","ADC2","CAN","CRC","I2C1","I2C2","IWDG","RTC","SPI1","SPI2","TIM1","TIM2","TIM3","TIM4","USART1","USART2","USART3","USB","WWDG","DMA"],
  files: { header: "stm32f103xb.h", define: "STM32F103xB", startup: "startup_stm32f103xb.s", cmsisRepo: "cmsis-device-f1", svd: "stm32f1/STM32F103.svd", openocd: "stm32f1x.cfg", linker: null },
  src: { pins: 'pins', memory: 'cmsis', files: 'cmsis', svd: 'svd', openocd: 'openocd' },
  notes: ["Имя скрипта компоновщика в проверенных примерах STM32Cube для этого кристалла не найдено — скрипт нужно генерировать по карте памяти","F1: вместо AFn используется ремап AFIO: третье поле функции — ремап из HAL (например USART1_ENABLE), при котором функция попадает на этот вывод; без третьего поля функция доступна на этом выводе без ремапа","Объём Flash/RAM — из open-pin-data для варианта «STM32F103C8»; серийные кристаллы одной линейки могут отличаться объёмом","Целевой файл OpenOCD: имя файла проверено в openocd-org/openocd; применимость к конкретному кристаллу — по таблице OpenOCD, здесь не проверялась"]
}
