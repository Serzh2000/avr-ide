export interface BoardPreset { name: string; fqbn: string; core: string }

export const BOARD_PRESETS: BoardPreset[] = [
  { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', core: 'arduino:avr' },
  { name: 'Arduino Nano', fqbn: 'arduino:avr:nano', core: 'arduino:avr' },
  { name: 'Arduino Mega', fqbn: 'arduino:avr:mega', core: 'arduino:avr' },
  { name: 'ESP8266 NodeMCU', fqbn: 'esp8266:esp8266:nodemcuv2', core: 'esp8266:esp8266' },
  { name: 'ESP32 Dev', fqbn: 'esp32:esp32:esp32', core: 'esp32:esp32' },
  { name: 'ESP32-S3', fqbn: 'esp32:esp32:esp32s3', core: 'esp32:esp32' },
  { name: 'ESP32-C3', fqbn: 'esp32:esp32:esp32c3', core: 'esp32:esp32' }
]

export const BAUDS = [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600]
