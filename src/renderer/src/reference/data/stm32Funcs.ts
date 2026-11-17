// СГЕНЕРИРОВАНО scripts/build-stm32-funcs.mjs — не править вручную.
// Функции выводов STM32 — из PeripheralPins.c ядра STM32duino (https://github.com/stm32duino/Arduino_Core_STM32, BSD-3-Clause, © STMicroelectronics).
/* eslint-disable */
export const stm32Funcs: Record<string, Record<string, string[]>> = {
 "f103c8": {
  "PA0": [
   "ADC1_IN0",
   "ADC2_IN0",
   "TIM2_CH1",
   "USART2 CTS"
  ],
  "PA1": [
   "ADC1_IN1",
   "ADC2_IN1",
   "TIM2_CH2",
   "USART2 RTS"
  ],
  "PA2": [
   "ADC1_IN2",
   "ADC2_IN2",
   "TIM2_CH3",
   "USART2 TX"
  ],
  "PA3": [
   "ADC1_IN3",
   "ADC2_IN3",
   "TIM2_CH4",
   "USART2 RX"
  ],
  "PA4": [
   "ADC1_IN4",
   "ADC2_IN4",
   "SPI1 SS"
  ],
  "PA5": [
   "ADC1_IN5",
   "ADC2_IN5",
   "SPI1 SCK"
  ],
  "PA6": [
   "ADC1_IN6",
   "ADC2_IN6",
   "TIM3_CH1",
   "SPI1 MISO"
  ],
  "PA7": [
   "ADC1_IN7",
   "ADC2_IN7",
   "TIM1_CH1N",
   "TIM3_CH2",
   "SPI1 MOSI"
  ],
  "PB0": [
   "ADC1_IN8",
   "ADC2_IN8",
   "TIM1_CH2N",
   "TIM3_CH3"
  ],
  "PB1": [
   "ADC1_IN9",
   "ADC2_IN9",
   "TIM1_CH3N",
   "TIM3_CH4"
  ],
  "PB7": [
   "I2C1 SDA",
   "TIM4_CH2",
   "USART1 RX"
  ],
  "PB9": [
   "I2C1 SDA",
   "TIM4_CH4",
   "CAN1 TX"
  ],
  "PB11": [
   "I2C2 SDA",
   "TIM2_CH4",
   "USART3 RX"
  ],
  "PB6": [
   "I2C1 SCL",
   "TIM4_CH1",
   "USART1 TX"
  ],
  "PB8": [
   "I2C1 SCL",
   "TIM4_CH3",
   "CAN1 RX"
  ],
  "PB10": [
   "I2C2 SCL",
   "TIM2_CH3",
   "USART3 TX"
  ],
  "PA8": [
   "TIM1_CH1"
  ],
  "PA9": [
   "TIM1_CH2",
   "USART1 TX"
  ],
  "PA10": [
   "TIM1_CH3",
   "USART1 RX"
  ],
  "PA11": [
   "TIM1_CH4",
   "USART1 CTS",
   "CAN1 RX",
   "USB_DM"
  ],
  "PA15": [
   "TIM2_CH1",
   "SPI1 SS"
  ],
  "PB3": [
   "TIM2_CH2",
   "SPI1 SCK"
  ],
  "PB4": [
   "TIM3_CH1",
   "SPI1 MISO"
  ],
  "PB5": [
   "TIM3_CH2",
   "SPI1 MOSI"
  ],
  "PB13": [
   "TIM1_CH1N",
   "USART3 CTS",
   "SPI2 SCK"
  ],
  "PB14": [
   "TIM1_CH2N",
   "USART3 RTS",
   "SPI2 MISO"
  ],
  "PB15": [
   "TIM1_CH3N",
   "SPI2 MOSI"
  ],
  "PA12": [
   "USART1 RTS",
   "CAN1 TX",
   "USB_DP"
  ],
  "PB12": [
   "SPI2 SS"
  ]
 },
 "f411ce": {
  "PA0": [
   "ADC1_IN0",
   "TIM2_CH1",
   "TIM5_CH1",
   "USART2 CTS"
  ],
  "PA1": [
   "ADC1_IN1",
   "TIM2_CH2",
   "TIM5_CH2",
   "USART2 RTS",
   "SPI4 MOSI"
  ],
  "PA2": [
   "ADC1_IN2",
   "TIM2_CH3",
   "TIM5_CH3",
   "TIM9_CH1",
   "USART2 TX"
  ],
  "PA3": [
   "ADC1_IN3",
   "TIM2_CH4",
   "TIM5_CH4",
   "TIM9_CH2",
   "USART2 RX"
  ],
  "PA4": [
   "ADC1_IN4",
   "SPI1 SS",
   "SPI3 SS"
  ],
  "PA5": [
   "ADC1_IN5",
   "TIM2_CH1",
   "SPI1 SCK"
  ],
  "PA6": [
   "ADC1_IN6",
   "TIM3_CH1",
   "SPI1 MISO"
  ],
  "PA7": [
   "ADC1_IN7",
   "TIM1_CH1N",
   "TIM3_CH2",
   "SPI1 MOSI"
  ],
  "PB0": [
   "ADC1_IN8",
   "TIM1_CH2N",
   "TIM3_CH3",
   "SPI5 SCK"
  ],
  "PB1": [
   "ADC1_IN9",
   "TIM1_CH3N",
   "TIM3_CH4",
   "SPI5 SS"
  ],
  "PB3": [
   "I2C2 SDA",
   "TIM2_CH2",
   "USART1 RX",
   "SPI1 SCK",
   "SPI3 SCK"
  ],
  "PB4": [
   "I2C3 SDA",
   "TIM3_CH1",
   "SPI1 MISO",
   "SPI3 MISO"
  ],
  "PB7": [
   "I2C1 SDA",
   "TIM4_CH2",
   "USART1 RX"
  ],
  "PB8": [
   "I2C3 SDA",
   "I2C1 SCL",
   "TIM4_CH3",
   "TIM10_CH1",
   "SPI5 MOSI"
  ],
  "PB9": [
   "I2C1 SDA",
   "I2C2 SDA",
   "TIM4_CH4",
   "TIM11_CH1",
   "SPI2 SS"
  ],
  "PA8": [
   "I2C3 SCL",
   "TIM1_CH1",
   "USB_OTG_FS_SOF"
  ],
  "PB6": [
   "I2C1 SCL",
   "TIM4_CH1",
   "USART1 TX"
  ],
  "PB10": [
   "I2C2 SCL",
   "TIM2_CH3",
   "SPI2 SCK"
  ],
  "PA9": [
   "TIM1_CH2",
   "USART1 TX",
   "USB_OTG_FS_VBUS"
  ],
  "PA10": [
   "TIM1_CH3",
   "USART1 RX",
   "SPI5 MOSI",
   "USB_OTG_FS_ID"
  ],
  "PA11": [
   "TIM1_CH4",
   "USART6 TX",
   "USART1 CTS",
   "SPI4 MISO",
   "USB_OTG_FS_DM"
  ],
  "PA15": [
   "TIM2_CH1",
   "USART1 TX",
   "SPI1 SS",
   "SPI3 SS"
  ],
  "PB5": [
   "TIM3_CH2",
   "SPI1 MOSI",
   "SPI3 MOSI"
  ],
  "PB13": [
   "TIM1_CH1N",
   "SPI2 SCK",
   "SPI4 SCK"
  ],
  "PB14": [
   "TIM1_CH2N",
   "SPI2 MISO"
  ],
  "PB15": [
   "TIM1_CH3N",
   "SPI2 MOSI"
  ],
  "PA12": [
   "USART6 RX",
   "USART1 RTS",
   "SPI5 MISO",
   "USB_OTG_FS_DP"
  ],
  "PB12": [
   "SPI3 SCK",
   "SPI2 SS",
   "SPI4 SS"
  ]
 },
 "f401re": {
  "PA0": [
   "ADC1_IN0",
   "TIM2_CH1",
   "TIM5_CH1",
   "USART2 CTS"
  ],
  "PA1": [
   "ADC1_IN1",
   "TIM2_CH2",
   "TIM5_CH2",
   "USART2 RTS"
  ],
  "PA2": [
   "ADC1_IN2",
   "TIM2_CH3",
   "TIM5_CH3",
   "TIM9_CH1",
   "USART2 TX"
  ],
  "PA3": [
   "ADC1_IN3",
   "TIM2_CH4",
   "TIM5_CH4",
   "TIM9_CH2",
   "USART2 RX"
  ],
  "PA4": [
   "ADC1_IN4",
   "SPI1 SS",
   "SPI3 SS"
  ],
  "PA5": [
   "ADC1_IN5",
   "TIM2_CH1",
   "SPI1 SCK"
  ],
  "PA6": [
   "ADC1_IN6",
   "TIM3_CH1",
   "SPI1 MISO"
  ],
  "PA7": [
   "ADC1_IN7",
   "TIM1_CH1N",
   "TIM3_CH2",
   "SPI1 MOSI"
  ],
  "PB0": [
   "ADC1_IN8",
   "TIM1_CH2N",
   "TIM3_CH3"
  ],
  "PB1": [
   "ADC1_IN9",
   "TIM1_CH3N",
   "TIM3_CH4"
  ],
  "PC0": [
   "ADC1_IN10"
  ],
  "PC1": [
   "ADC1_IN11"
  ],
  "PC2": [
   "ADC1_IN12",
   "SPI2 MISO"
  ],
  "PC3": [
   "ADC1_IN13",
   "SPI2 MOSI"
  ],
  "PC4": [
   "ADC1_IN14"
  ],
  "PC5": [
   "ADC1_IN15"
  ],
  "PB3": [
   "I2C2 SDA",
   "TIM2_CH2",
   "SPI1 SCK",
   "SPI3 SCK"
  ],
  "PB4": [
   "I2C3 SDA",
   "TIM3_CH1",
   "SPI1 MISO",
   "SPI3 MISO"
  ],
  "PB7": [
   "I2C1 SDA",
   "TIM4_CH2",
   "USART1 RX"
  ],
  "PB9": [
   "I2C1 SDA",
   "TIM4_CH4",
   "TIM11_CH1",
   "SPI2 SS"
  ],
  "PC9": [
   "I2C3 SDA",
   "TIM3_CH4"
  ],
  "PA8": [
   "I2C3 SCL",
   "TIM1_CH1",
   "USB_OTG_FS_SOF"
  ],
  "PB6": [
   "I2C1 SCL",
   "TIM4_CH1",
   "USART1 TX"
  ],
  "PB8": [
   "I2C1 SCL",
   "TIM4_CH3",
   "TIM10_CH1"
  ],
  "PB10": [
   "I2C2 SCL",
   "TIM2_CH3",
   "SPI2 SCK"
  ],
  "PA9": [
   "TIM1_CH2",
   "USART1 TX",
   "USB_OTG_FS_VBUS"
  ],
  "PA10": [
   "TIM1_CH3",
   "USART1 RX",
   "USB_OTG_FS_ID"
  ],
  "PA11": [
   "TIM1_CH4",
   "USART6 TX",
   "USART1 CTS",
   "USB_OTG_FS_DM"
  ],
  "PA15": [
   "TIM2_CH1",
   "SPI1 SS",
   "SPI3 SS"
  ],
  "PB5": [
   "TIM3_CH2",
   "SPI1 MOSI",
   "SPI3 MOSI"
  ],
  "PB13": [
   "TIM1_CH1N",
   "SPI2 SCK"
  ],
  "PB14": [
   "TIM1_CH2N",
   "SPI2 MISO"
  ],
  "PB15": [
   "TIM1_CH3N",
   "SPI2 MOSI"
  ],
  "PC6": [
   "TIM3_CH1",
   "USART6 TX"
  ],
  "PC7": [
   "TIM3_CH2",
   "USART6 RX"
  ],
  "PC8": [
   "TIM3_CH3"
  ],
  "PA12": [
   "USART6 RX",
   "USART1 RTS",
   "USB_OTG_FS_DP"
  ],
  "PC12": [
   "SPI3 MOSI"
  ],
  "PC11": [
   "SPI3 MISO"
  ],
  "PC10": [
   "SPI3 SCK"
  ],
  "PB12": [
   "SPI2 SS"
  ]
 },
 "l432kc": {
  "PA0": [
   "ADC1_IN5",
   "TIM2_CH1",
   "USART2 CTS"
  ],
  "PA1": [
   "ADC1_IN6",
   "TIM2_CH2",
   "TIM15_CH1N",
   "USART2 RTS",
   "SPI1 SCK"
  ],
  "PA2": [
   "ADC1_IN7",
   "TIM2_CH3",
   "TIM15_CH1",
   "LPUART1 TX",
   "USART2 TX"
  ],
  "PA3": [
   "ADC1_IN8",
   "TIM2_CH4",
   "TIM15_CH2",
   "LPUART1 RX",
   "USART2 RX"
  ],
  "PA4": [
   "ADC1_IN9",
   "DAC1_OUT1",
   "SPI1 SS",
   "SPI3 SS"
  ],
  "PA5": [
   "ADC1_IN10",
   "DAC1_OUT2",
   "TIM2_CH1",
   "SPI1 SCK"
  ],
  "PA6": [
   "ADC1_IN11",
   "TIM16_CH1",
   "LPUART1 CTS",
   "SPI1 MISO"
  ],
  "PA7": [
   "ADC1_IN12",
   "I2C3 SCL",
   "TIM1_CH1N",
   "SPI1 MOSI"
  ],
  "PB0": [
   "ADC1_IN15",
   "TIM1_CH2N",
   "SPI1 SS"
  ],
  "PB1": [
   "ADC1_IN16",
   "TIM1_CH3N",
   "LPUART1 RTS"
  ],
  "PA10": [
   "I2C1 SDA",
   "TIM1_CH3",
   "USART1 RX"
  ],
  "PB4": [
   "I2C3 SDA",
   "USART1 CTS",
   "SPI1 MISO",
   "SPI3 MISO"
  ],
  "PB7": [
   "I2C1 SDA",
   "USART1 RX"
  ],
  "PA9": [
   "I2C1 SCL",
   "TIM1_CH2",
   "USART1 TX"
  ],
  "PB6": [
   "I2C1 SCL",
   "TIM16_CH1N",
   "USART1 TX"
  ],
  "PA8": [
   "TIM1_CH1"
  ],
  "PA11": [
   "TIM1_CH4",
   "USART1 CTS",
   "SPI1 MISO",
   "CAN1 RX",
   "USB_DM"
  ],
  "PA15": [
   "TIM2_CH1",
   "USART2 RX",
   "SPI1 SS",
   "SPI3 SS"
  ],
  "PB3": [
   "TIM2_CH2",
   "USART1 RTS",
   "SPI1 SCK",
   "SPI3 SCK"
  ],
  "PA12": [
   "USART1 RTS",
   "SPI1 MOSI",
   "CAN1 TX",
   "USB_DP"
  ],
  "PB5": [
   "SPI1 MOSI",
   "SPI3 MOSI"
  ],
  "PA13": [
   "USB_NOE"
  ]
 }
}
