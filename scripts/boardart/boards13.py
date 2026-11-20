# Платы пятой волны, часть 3: Adafruit Feather ESP32 V2, Feather ESP32-S2, Feather nRF52840 Sense (форм-фактор Feather 50.8 x 22.86).
# Порядок выводов — по официальным схемам Adafruit (PDF в репозиториях *-PCB). Мелкие детали приблизительны.
import boards4

BOARDS = {}
FP = boards4.feather_pins
R = ['VBAT', 'EN', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D6', 'D5', 'SCL', 'SDA']


def feather(title, left, right, comps):
    s = dict(boards4.BOARDS['feather-esp32s3'])
    s['title'] = title
    s['pins'] = FP(left, right)
    s['comps'] = comps
    return s


BOARDS['feather-esp32-v2'] = feather('Feather ESP32 V2', ['RESET', '3V3', 'NC', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'D37'],
    ['VBAT', 'EN', 'VBUS', 'LED', 'D12', 'D27', 'D33', 'D15', 'D32', 'D14', 'SCL', 'SDA'], [
        ('usbc', dict(cx=11.43, edge=-0.6, side='t')),
        ('btn', dict(cx=4.6, cy=12.2, small=True)), ('btn', dict(cx=4.6, cy=19.4, small=True)),
        ('smd', dict(cx=16.6, cy=11.4, w=6.4, h=4.4, kind='c')),
        ('rgb', dict(cx=16.4, cy=21.6)), ('led', dict(cx=16.4, cy=17.6, color='red')),
        ('shieldbox', dict(cx=11.43, cy=34.8, w=14.0, h=15.0, text='ESP32-PICO')),
        ('antenna', dict(cx=11.43, cy=45.6, w=11.0, h=4.0, n=4)),
        ('sot223', dict(cx=9.0, cy=22.6, rot=0, small=True)),
        ('smd', dict(cx=8.0, cy=15.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=11.43, y=26.6, t='FEATHER ESP32 V2', size=0.6)),
    ])
BOARDS['feather-esp32-s2'] = feather('Feather ESP32-S2', ['RESET', '3V3', '3V3', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'DEBUG_TX'], R, [
        ('usbc', dict(cx=11.43, edge=-0.6, side='t')),
        ('btn', dict(cx=4.6, cy=12.2, small=True)), ('btn', dict(cx=4.6, cy=19.4, small=True)),
        ('smd', dict(cx=16.6, cy=11.4, w=6.4, h=4.4, kind='c')),
        ('rgb', dict(cx=16.4, cy=21.6)), ('led', dict(cx=16.4, cy=17.6, color='red')),
        ('shieldbox', dict(cx=11.43, cy=34.8, w=14.0, h=15.0, text='ESP32-S2')),
        ('antenna', dict(cx=11.43, cy=45.6, w=11.0, h=4.0, n=4)),
        ('sot223', dict(cx=9.0, cy=22.6, rot=0, small=True)),
        ('smd', dict(cx=8.0, cy=15.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=11.43, y=26.6, t='FEATHER ESP32-S2', size=0.6)),
    ])
BOARDS['feather-nrf52840-sense'] = feather('Feather nRF52840 Sense', ['RESET', '3V3', 'AREF', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'D2'], R, [
        ('usbc', dict(cx=11.43, edge=-0.6, side='t')),
        ('btn', dict(cx=4.6, cy=12.2, small=True)), ('btn', dict(cx=4.6, cy=19.4, small=True)),
        ('smd', dict(cx=16.6, cy=11.4, w=6.4, h=4.4, kind='c')),
        ('rgb', dict(cx=16.4, cy=21.6)), ('led', dict(cx=16.4, cy=17.6, color='red')),
        ('shieldbox', dict(cx=11.43, cy=34.8, w=14.0, h=15.0, text='nRF52840')),
        ('antenna', dict(cx=11.43, cy=45.6, w=11.0, h=4.0, n=3)),
        ('sot223', dict(cx=9.0, cy=22.6, rot=0, small=True)),
        ('smd', dict(cx=8.0, cy=15.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=11.43, y=26.6, t='FEATHER SENSE', size=0.6)),
    ])
