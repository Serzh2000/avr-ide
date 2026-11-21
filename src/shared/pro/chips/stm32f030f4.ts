// СГЕНЕРИРОВАНО scripts/build-chipdb.mjs — не править вручную.
// STM32F030F4P6: выводы и сигналы — STMicroelectronics/STM32_open_pin_data (BSD-3-Clause, © STMicroelectronics); память, макрос устройства, startup — cmsis-device-f0 (Apache-2.0).
/* eslint-disable */
import type { ChipRecord } from '../chipdb'

export const chip: ChipRecord = {
  id: "stm32f030f4", name: "STM32F030F4P6", family: "STM32F0", line: "STM32F0x0 Value Line", core: "Cortex-M0", fpu: false, maxMHz: 48, dieId: "DIE444",
  flashKB: 16, ramKB: 4, voltage: [2.4,3.6], tempC: [-40,85],
  regions: [
    ["Flash",134217728,16384,"flash","адрес — CMSIS, объём — open-pin-data"],
    ["SRAM",536870912,4096,"ram","адрес — CMSIS, объём — open-pin-data"]
  ],
  packages: [
    { name: "TSSOP20", part: "STM32F030F4Px", pins: [
     ["1","BOOT0","boot","",[]],
     ["2","PF0","io","OSC_IN",[["RCC_OSC_IN",-1]]],
     ["3","PF1","io","OSC_OUT",[["RCC_OSC_OUT",-1]]],
     ["4","NRST","reset","",[]],
     ["5","VDDA","power","",[]],
     ["6","PA0","io","",[["ADC_IN0",-1],["RTC_TAMP2",0],["SYS_WKUP1",0],["USART1_CTS",1]]],
     ["7","PA1","io","",[["ADC_IN1",-1],["USART1_DE",1],["USART1_RTS",1]]],
     ["8","PA2","io","",[["ADC_IN2",-1],["USART1_TX",1]]],
     ["9","PA3","io","",[["ADC_IN3",-1],["USART1_RX",1]]],
     ["10","PA4","io","",[["ADC_IN4",-1],["SPI1_NSS",0],["TIM14_CH1",4],["USART1_CK",1]]],
     ["11","PA5","io","",[["ADC_IN5",-1],["SPI1_SCK",0]]],
     ["12","PA6","io","",[["ADC_IN6",-1],["SPI1_MISO",0],["TIM16_CH1",5],["TIM1_BKIN",2],["TIM3_CH1",1]]],
     ["13","PA7","io","",[["ADC_IN7",-1],["SPI1_MOSI",0],["TIM14_CH1",4],["TIM17_CH1",5],["TIM1_CH1N",2],["TIM3_CH2",1]]],
     ["14","PB1","io","",[["ADC_IN9",-1],["TIM14_CH1",0],["TIM1_CH3N",2],["TIM3_CH4",1]]],
     ["15","VSS","power","",[]],
     ["16","VDD","power","",[]],
     ["17","PA9","io","",[["I2C1_SCL",4],["TIM1_CH2",2],["USART1_TX",1]]],
     ["18","PA10","io","",[["I2C1_SDA",4],["TIM17_BKIN",0],["TIM1_CH3",2],["USART1_RX",1]]],
     ["19","PA13","io","",[["IR_OUT",1],["SYS_SWDIO",-1]]],
     ["20","PA14","io","",[["SYS_SWCLK",0],["USART1_TX",1]]]
    ] }
  ],
  peripherals: ["ADC","CRC","I2C1","IRTIM","IWDG","RTC","SPI1","TIM1","TIM3","TIM14","TIM16","TIM17","USART1","WWDG","DMA"],
  files: { header: "stm32f030x6.h", define: "STM32F030x6", startup: "startup_stm32f030x6.s", cmsisRepo: "cmsis-device-f0", svd: "stm32f0/STM32F0x0.svd", openocd: "stm32f0x.cfg", linker: null },
  src: { pins: 'pins', memory: 'cmsis', files: 'cmsis', svd: 'svd', openocd: 'openocd' },
  notes: ["Имя скрипта компоновщика в проверенных примерах STM32Cube для этого кристалла не найдено — скрипт нужно генерировать по карте памяти","Объём Flash/RAM — из open-pin-data для варианта «STM32F030F4»; серийные кристаллы одной линейки могут отличаться объёмом","Целевой файл OpenOCD: имя файла проверено в openocd-org/openocd; применимость к конкретному кристаллу — по таблице OpenOCD, здесь не проверялась"]
}
