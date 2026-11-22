export const PICO_BOARDS = [
  { id: 'raspberry_pi_pico', name: 'Raspberry Pi Pico' },
  { id: 'raspberry_pi_pico_w', name: 'Raspberry Pi Pico W' },
  { id: 'raspberry_pi_pico2', name: 'Raspberry Pi Pico 2' },
  { id: 'raspberry_pi_pico2_w', name: 'Raspberry Pi Pico 2 W' }
] as const

export type PicoBoardId = (typeof PICO_BOARDS)[number]['id']

export const PICO_BLINK = `import time
import board
import digitalio

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

while True:
    led.value = not led.value
    time.sleep(0.5)
`
