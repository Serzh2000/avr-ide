import type { FuncEntry } from '../types'

/** AVR-специфика (Uno/Nano/Mega, ATmega328P/2560). */
export const avr: FuncEntry[] = [
  {
    name: 'DDRx', category: 'Регистры AVR',
    signature: 'DDRB, DDRC, DDRD (Mega: DDRA..DDRL)',
    description: 'Регистр направления порта: бит 1 — выход, 0 — вход.',
    params: [], returns: 'регистр (volatile uint8_t)',
    example: 'DDRB |= (1 << PB5);   // D13 на Uno — выход\nDDRB &= ~(1 << PB5);  // вход',
    platforms: ['avr'],
    notes: ['Uno/Nano: порт B — D8..D13, порт C — A0..A5, порт D — D0..D7.']
  },
  {
    name: 'PORTx', category: 'Регистры AVR',
    signature: 'PORTB, PORTC, PORTD',
    description: 'Регистр выходов порта. Для входов бит 1 включает подтяжку.',
    params: [], returns: 'регистр',
    example: 'PORTB |= (1 << PB5);   // D13 = HIGH\nPORTB &= ~(1 << PB5);  // D13 = LOW\nPORTB ^= (1 << PB5);   // переключить',
    platforms: ['avr'],
    warnings: ['Прямая запись регистров быстрее digitalWrite, но не переносима на другие платформы.']
  },
  {
    name: 'PINx', category: 'Регистры AVR',
    signature: 'PINB, PINC, PIND',
    description: 'Регистр чтения состояния пинов порта. Запись 1 в бит переключает соответствующий выход (toggle).',
    params: [], returns: 'регистр',
    example: 'if (PIND & (1 << PD2)) { /* D2 = HIGH */ }',
    platforms: ['avr']
  },
  {
    name: 'ISR', category: 'Регистры AVR',
    signature: 'ISR(vector_name)',
    description: 'Макрос объявления обработчика прерывания по вектору (avr/interrupt.h).',
    params: [{ name: 'vector_name', type: 'вектор', desc: 'Например TIMER1_COMPA_vect, INT0_vect, PCINT0_vect' }],
    returns: 'ничего',
    example: '#include <avr/interrupt.h>\nISR(TIMER1_COMPA_vect) { /* раз в период сравнения */ }',
    platforms: ['avr'],
    warnings: ['Внутри ISR прерывания по умолчанию запрещены; держите обработчик коротким.']
  },
  {
    name: 'sei', category: 'Регистры AVR', signature: 'void sei()', description: 'Глобальное разрешение прерываний.',
    params: [], returns: 'ничего', example: 'sei();', platforms: ['avr']
  },
  {
    name: 'cli', category: 'Регистры AVR', signature: 'void cli()', description: 'Глобальный запрет прерываний.',
    params: [], returns: 'ничего', example: 'cli();\nTCNT1 = 0;\nsei();', platforms: ['avr']
  },
  {
    name: 'TCCRnA/TCCRnB', category: 'Регистры AVR',
    signature: 'TCCR1A, TCCR1B, OCR1A, TIMSK1 ...',
    description: 'Регистры таймеров. Timer0/Timer2 — 8 бит, Timer1 — 16 бит (на Mega также Timer3/4/5).',
    params: [], returns: 'регистры',
    example: '// Timer1, CTC, ~1 Гц при 16 МГц\nnoInterrupts();\nTCCR1A = 0;\nTCCR1B = (1 << WGM12) | (1 << CS12) | (1 << CS10); // делитель 1024\nOCR1A = 15624;\nTIMSK1 |= (1 << OCIE1A);\ninterrupts();',
    platforms: ['avr'],
    warnings: [
      'Timer0 используется для millis(), delay() и micros(): изменение его настроек ломает время.',
      'Timer2 используется tone(); Timer1 — библиотекой Servo (Uno): конфликты с ШИМ на соответствующих пинах.'
    ],
    notes: ['Значения делителей и битов смотрите в даташите ATmega328P (проверить конкретные биты перед использованием).']
  },
  {
    name: 'ADCSRA', category: 'Регистры AVR',
    signature: 'ADCSRA, ADMUX, ADCL/ADCH',
    description: 'Регистры АЦП. Через ADCSRA можно менять делитель частоты АЦП для ускорения analogRead.',
    params: [], returns: 'регистры',
    example: '// ускорить analogRead (делитель 16 вместо 128), точность падает\nADCSRA = (ADCSRA & ~0x07) | 0x04;',
    platforms: ['avr'],
    notes: ['Делитель 128 по умолчанию даёт ~9600 измерений/с; значения проверить в даташите.']
  },
  {
    name: 'EEPROM.read', category: 'EEPROM',
    signature: 'uint8_t EEPROM.read(int address)',
    description: 'Читает байт из EEPROM (#include <EEPROM.h>).',
    params: [{ name: 'address', type: 'int', desc: 'Адрес: 0..1023 (Uno/Nano), 0..4095 (Mega)' }],
    returns: 'Байт; пустая ячейка = 255',
    example: '#include <EEPROM.h>\nbyte v = EEPROM.read(0);',
    platforms: ['avr']
  },
  {
    name: 'EEPROM.write', category: 'EEPROM',
    signature: 'void EEPROM.write(int address, uint8_t value)',
    description: 'Записывает байт в EEPROM.',
    params: [{ name: 'address', type: 'int', desc: 'Адрес' }, { name: 'value', type: 'uint8_t', desc: 'Значение' }],
    returns: 'ничего', example: 'EEPROM.write(0, 42);', platforms: ['avr'],
    warnings: ['Ресурс ячейки ~100 000 записей (по даташиту) — не пишите в EEPROM из loop() без нужды; предпочитайте update().']
  },
  {
    name: 'EEPROM.update', category: 'EEPROM',
    signature: 'void EEPROM.update(int address, uint8_t value)',
    description: 'Пишет байт только если значение отличается от записанного — экономит ресурс.',
    params: [{ name: 'address', type: 'int', desc: 'Адрес' }, { name: 'value', type: 'uint8_t', desc: 'Значение' }],
    returns: 'ничего', example: 'EEPROM.update(0, counter);', platforms: ['avr']
  },
  {
    name: 'EEPROM.put', category: 'EEPROM',
    signature: 'T& EEPROM.put(int address, const T& value)',
    description: 'Записывает переменную любого типа/структуру (использует update).',
    params: [{ name: 'address', type: 'int', desc: 'Начальный адрес' }, { name: 'value', type: 'T', desc: 'Данные' }],
    returns: 'ссылка на value', example: 'float f = 3.14;\nEEPROM.put(10, f);', platforms: ['avr']
  },
  {
    name: 'EEPROM.get', category: 'EEPROM',
    signature: 'T& EEPROM.get(int address, T& value)',
    description: 'Читает переменную/структуру из EEPROM.',
    params: [{ name: 'address', type: 'int', desc: 'Начальный адрес' }, { name: 'value', type: 'T', desc: 'Куда читать' }],
    returns: 'ссылка на value', example: 'float f;\nEEPROM.get(10, f);', platforms: ['avr']
  },
  {
    name: 'EEPROM.length', category: 'EEPROM', signature: 'uint16_t EEPROM.length()',
    description: 'Размер EEPROM в байтах.', params: [], returns: 'Uno/Nano 1024, Mega 4096',
    example: 'int n = EEPROM.length();', platforms: ['avr']
  },
  {
    name: 'PROGMEM', category: 'Память AVR', signature: 'const type name[] PROGMEM = {...}',
    description: 'Хранит константные данные во flash вместо SRAM (#include <avr/pgmspace.h>). Читать через pgm_read_byte/pgm_read_word.',
    params: [], returns: '—',
    example: 'const char msg[] PROGMEM = "Hello";\nchar c = pgm_read_byte(&msg[0]);',
    platforms: ['avr'], notes: ['На ESP константы можно держать во flash; PROGMEM поддерживается для совместимости (проверить детали).']
  },
  {
    name: 'F', category: 'Память AVR', signature: 'F("text")',
    description: 'Макрос: строковый литерал во flash вместо SRAM. Экономит ОЗУ на Uno (2 КБ).',
    params: [{ name: 'text', type: 'литерал', desc: 'Строка' }], returns: '__FlashStringHelper*',
    example: 'Serial.println(F("Start"));', platforms: ['avr']
  },
  {
    name: 'wdt_enable', category: 'Регистры AVR', signature: 'wdt_enable(timeout)',
    description: 'Включает сторожевой таймер (#include <avr/wdt.h>). Сброс при отсутствии wdt_reset().',
    params: [{ name: 'timeout', type: 'константа', desc: 'WDTO_15MS ... WDTO_8S' }], returns: 'ничего',
    example: '#include <avr/wdt.h>\nwdt_enable(WDTO_2S);\n/* в loop: */ wdt_reset();',
    platforms: ['avr'],
    warnings: ['На старых загрузчиках Uno/Nano возможны циклические перезагрузки после WDT-сброса (проверить для вашего загрузчика).']
  }
]
