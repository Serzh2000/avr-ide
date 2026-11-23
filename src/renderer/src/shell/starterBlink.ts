import type { CoreInfo } from '../../../main/cli/types'

interface BlinkTarget {
  core: string
  version: string
}

// Default board configurations checked against the core sources and a Blink build.
const arduinoAvr = { core: 'arduino:avr', version: '1.8.8' }
const arduinoPico = { core: 'rp2040:rp2040', version: '6.4.0' }
const blinkTargets = new Map<string, BlinkTarget>([
  ['arduino:avr:uno', arduinoAvr],
  ['arduino:avr:nano', arduinoAvr],
  ['arduino:avr:mega', arduinoAvr],
  ['arduino:avr:leonardo', arduinoAvr],
  ['arduino:avr:micro', arduinoAvr],
  ['rp2040:rp2040:rpipico', arduinoPico],
  ['rp2040:rp2040:rpipicow', arduinoPico],
  ['rp2040:rp2040:rpipico2', arduinoPico],
  ['rp2040:rp2040:rpipico2w', arduinoPico]
])

const blink = `// Мигание встроенным светодиодом платы.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`

export function starterBlink(fqbn: string, cores: readonly CoreInfo[] | null): string | null {
  const target = blinkTargets.get(fqbn)
  if (!target || !cores?.some(({ id, installed }) => id === target.core && installed === target.version)) return null
  return blink
}
