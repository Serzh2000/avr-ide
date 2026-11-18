# Платы, добавленные позже (Arduino Nano-семейство, Micro, XIAO, Espressif DevKit, Teensy). Единицы — мм, начало — левый верхний угол, ось y вниз.
# Порядок выводов — по официальным схемам распиновки производителей; размеры деталей и положение мелочи — типовые/приблизительные.
# Координаты выводов (pins) — те же числа, что рисуют площадки и попадают в слой выводов приложения.
from boards import col, row

BOARDS = {}

NANO_Y0 = round((45 - 14 * 2.54) / 2, 2)   # 15 выводов, шаг 2.54, центрированы по длине 45 мм

# ---------------- Arduino Nano Every (45 x 18) ----------------
NEL = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST', 'GND', 'VIN']
NER = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'RX', 'TX']
BOARDS['nano-every'] = dict(
    W=18, H=45, mask='teal', radius=1.0, title='Nano Every',
    pins=col('L', 1.38, NANO_Y0, NEL, 'r') + col('R', 16.62, NANO_Y0, NER, 'l'),
    comps=[
        ('micro', dict(cx=9.0, edge=-1.4, side='t')),
        ('btn', dict(cx=9.0, cy=8.4, small=True)),
        ('qfp', dict(cx=9.0, cy=24.5, body=7.0, pins=12, rot=0, text='ATMEGA\n4809')),
        ('qfn', dict(cx=9.0, cy=14.8, s=3.4, text='', pins=4)),
        ('led', dict(cx=5.4, cy=11.2, color='green')), ('led', dict(cx=12.6, cy=11.2, color='red')),
        ('sot223', dict(cx=9.0, cy=37.4, rot=0, small=True)),
        ('smd', dict(cx=5.6, cy=33.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=12.4, cy=33.4, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=5.6, cy=40.8, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=12.4, cy=40.8, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=9.0, y=18.8, t='NANO EVERY', size=0.75)),
    ])

# ---------------- Arduino Nano 33 IoT (45 x 18) ----------------
BOARDS['nano-33-iot'] = dict(
    W=18, H=45, mask='teal', radius=1.0, title='Nano 33 IoT',
    pins=col('L', 1.38, NANO_Y0, NEL, 'r') + col('R', 16.62, NANO_Y0, NER, 'l'),
    comps=[
        ('micro', dict(cx=9.0, edge=-1.4, side='t')),
        ('btn', dict(cx=9.0, cy=8.4, small=True)),
        ('qfp', dict(cx=9.0, cy=20.5, body=7.0, pins=12, rot=0, text='SAMD21\nG18A')),
        ('soic', dict(cx=5.0, cy=13.2, w=3.0, h=2.4, text='', pins=8)),
        ('shieldbox', dict(cx=9.0, cy=34.5, w=11.0, h=8.6, text='NINA-W102')),
        ('antenna', dict(cx=9.0, cy=41.4, w=9.0, h=3.2, n=4)),
        ('led', dict(cx=5.4, cy=11.2, color='green')), ('led', dict(cx=12.6, cy=11.2, color='red')),
        ('smd', dict(cx=5.4, cy=27.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=12.6, cy=27.4, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=12.6, cy=14.6, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=9.0, y=16.4, t='NANO 33 IOT', size=0.7)),
    ])

# ---------------- Arduino Nano ESP32 (45 x 18) ----------------
NEL2 = ['D13', '3V3', 'B0', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'VUSB', 'B1', 'GND', 'VIN']
BOARDS['nano-esp32'] = dict(
    W=18, H=45, mask='teal', radius=1.0, title='Nano ESP32',
    pins=col('L', 1.38, NANO_Y0, NEL2, 'r') + col('R', 16.62, NANO_Y0, NER, 'l'),
    comps=[
        ('usbc', dict(cx=9.0, edge=-2.0, side='t')),
        ('btn', dict(cx=9.0, cy=10.2, small=True)),
        ('soic', dict(cx=5.0, cy=15.2, w=3.0, h=2.4, text='', pins=8)),
        ('rgb', dict(cx=13.0, cy=15.0)),
        ('qfn', dict(cx=9.0, cy=22.0, s=4.0, text='', pins=5)),
        ('shieldbox', dict(cx=9.0, cy=34.0, w=11.6, h=9.6, text='NORA-W106')),
        ('antenna', dict(cx=9.0, cy=41.6, w=9.0, h=3.0, n=4)),
        ('led', dict(cx=5.4, cy=27.0, color='green')), ('led', dict(cx=12.6, cy=27.0, color='red')),
        ('smd', dict(cx=5.4, cy=19.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=12.6, cy=19.6, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=26.4, t='NANO ESP32', size=0.7)),
    ])

# ---------------- Arduino Micro (48 x 18, по 17 выводов) ----------------
MIY0 = 3.7
MIL = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'NC', 'NC', '5V', 'RST', 'GND', 'VIN', 'D14', 'D15']
MIR = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'D0', 'D1', 'D17', 'D16']
BOARDS['micro'] = dict(
    W=18, H=48, mask='teal', radius=1.0, title='Arduino Micro',
    pins=col('L', 1.38, MIY0, MIL, 'r') + col('R', 16.62, MIY0, MIR, 'l'),
    comps=[
        ('micro', dict(cx=9.0, edge=-1.4, side='t')),
        ('btn', dict(cx=9.0, cy=9.4, small=True)),
        ('qfp', dict(cx=9.0, cy=22.5, body=7.0, pins=11, rot=45, text='ATMEGA\n32U4')),
        ('xtal', dict(cx=9.0, cy=32.2, w=3.6, h=2.2, text='16M')),
        ('icsp', dict(cx=9.0, cy=43.6, cols=3, rows=2)),
        ('led', dict(cx=5.4, cy=14.0, color='green')), ('led', dict(cx=9.0, cy=14.0, color='red')), ('led', dict(cx=12.6, cy=14.0, color='green')),
        ('sot223', dict(cx=9.0, cy=37.6, rot=0, small=True)),
        ('smd', dict(cx=5.6, cy=29.2, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=12.4, cy=29.2, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=17.6, t='MICRO', size=0.9)),
    ])

# ---------------- Seeed XIAO ESP32C3 (21 x 17.8, площадки на краю) ----------------
XCL = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']
XCR = ['5V', 'GND', '3V3', 'D10', 'D9', 'D8', 'D7']
BOARDS['xiao-esp32c3'] = dict(
    W=17.8, H=21, mask='black', radius=1.2, title='XIAO ESP32C3', pin_silk=False,
    pins=col('L', 1.0, 2.75, XCL, 'r') + col('R', 16.8, 2.75, XCR, 'l'),
    comps=[
        ('usbc', dict(cx=8.9, edge=-0.9, side='t')),
        ('shieldbox', dict(cx=8.9, cy=11.2, w=10.6, h=8.8, text='ESP32-C3')),
        ('btn', dict(cx=4.6, cy=18.4, small=True)), ('btn', dict(cx=13.2, cy=18.4, small=True)),
        ('smd', dict(cx=8.9, cy=18.0, w=2.4, h=2.0, kind='c')),
        ('led', dict(cx=14.6, cy=5.0, color='red')),
        ('smd', dict(cx=4.2, cy=6.8, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.6, cy=7.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=8.9, y=15.4, t='XIAO', size=0.7)),
    ])

# ---------------- ESP32-S2-DevKitM-1 (габариты условные, 21 вывод на сторону) ----------------
S2L = ['3V3', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '5V', 'G']
S2R = ['G', 'RST', '46', '45', 'RX', 'TX', '42', '41', '40', '39', '38', '37', '36', '35', '34', '33', '26', '21', '20', '19', '18']
BOARDS['esp32-s2-devkitm'] = dict(
    W=25.4, H=67.2, mask='black', radius=1.4, title='ESP32-S2-DevKitM-1',
    pins=col('L', 1.27, 6, S2L, 'r') + col('R', 24.13, 6, S2R, 'l'),
    comps=[
        ('module', dict(x=5.0, y=0, w=15.4, h=20.5, ant=5.8, text=['ESP32-S2-MINI-2', 'N4R2'], pad_pitch=0.8)),
        ('micro', dict(cx=12.7, edge=67.8, side='b')),
        ('qfn', dict(cx=9.0, cy=50.0, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=5.2, cy=59.0)), ('btn', dict(cx=20.2, cy=59.0)),
        ('led', dict(cx=6.4, cy=24.6, color='red')), ('rgb', dict(cx=18.8, cy=24.6)),
        ('sot223', dict(cx=17.2, cy=46.0, rot=0)),
        ('smd', dict(cx=12.6, cy=25.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=12.4, cy=44.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=15.2, cy=55.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=19.0, cy=51.4, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=12.7, y=30.6, t='ESP32-S2-DevKitM-1', size=1.0)),
        ('text', dict(x=5.2, y=61.8, t='BOOT', size=0.85)), ('text', dict(x=20.2, y=61.8, t='RST', size=0.85)),
    ])

# ---------------- ESP32-C6-DevKitC-1 (габариты условные 51.8 x 25.4) ----------------
C6L = ['3V3', 'RST', '4', '5', '6', '7', '0', '1', '8', '10', '11', '2', '3', '5V', 'G', 'NC']
C6R = ['G', 'TX', 'RX', '15', '23', '22', '21', '20', '19', '18', '9', 'G', '13', '12', 'G', 'NC']
BOARDS['esp32-c6-devkitc'] = dict(
    W=25.4, H=51.8, mask='black', radius=1.4, title='ESP32-C6-DevKitC-1',
    pins=col('L', 1.27, 6, C6L, 'r') + col('R', 24.13, 6, C6R, 'l'),
    comps=[
        ('module', dict(x=3.7, y=0, w=18, h=25.5, ant=6.6, text=['ESP32-C6-WROOM-1', 'N8'], pad_pitch=1.27)),
        ('usbc', dict(cx=7.6, edge=52.3, side='b')), ('usbc', dict(cx=18.4, edge=52.3, side='b')),
        ('text', dict(x=12.7, y=27.0, t='ESP32-C6-DevKitC-1', size=0.8)),
        ('led', dict(cx=6.4, cy=29.6, color='red')), ('rgb', dict(cx=18.4, cy=29.6)),
        ('btn', dict(cx=5.6, cy=34.2, small=True)), ('btn', dict(cx=19.8, cy=34.2, small=True)),
        ('text', dict(x=5.6, y=37.0, t='BOOT', size=0.65)), ('text', dict(x=19.8, y=37.0, t='RST', size=0.65)),
        ('qfn', dict(cx=11.0, cy=40.4, s=5, text='CP2102N', pins=7)),
        ('sot223', dict(cx=18.4, cy=40.6, rot=0, small=True)),
        ('smd', dict(cx=12.4, cy=30.2, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=15.4, cy=34.6, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=15.4, cy=43.2, w=1.0, h=0.5, kind='c')),
    ])

# ---------------- Teensy 4.0 (35.56 x 17.78, 2 x 14 выводов) ----------------
T40T = ['VIN', 'GND', '3V3', '23', '22', '21', '20', '19', '18', '17', '16', '15', '14', '13']
T40B = ['GND', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
BOARDS['teensy-40'] = dict(
    W=35.56, H=17.78, mask='green', radius=0.8, title='Teensy 4.0',
    pins=row('t', 1.27, 1.27, T40T, 'b') + row('b', 1.27, 16.51, T40B, 't'),
    comps=[
        ('micro', dict(cx=0.0, edge=-1.6, side='l', cy=8.89)),
        ('bga', dict(cx=17.0, cy=8.89, s=9.4, text='IMXRT1062\nDVL6A')),
        ('btn', dict(cx=29.2, cy=7.6, small=True)),
        ('xtal_sm', dict(cx=24.6, cy=5.2)),
        ('soic', dict(cx=7.6, cy=5.6, w=2.6, h=2.6, text='', pins=0, sot=True)),
        ('soic', dict(cx=25.4, cy=12.4, w=3.0, h=2.4, text='', pins=8)),
        ('led', dict(cx=31.2, cy=11.6, color='red')),
        ('smd', dict(cx=8.0, cy=11.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=10.0, cy=11.6, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=28.0, cy=11.8, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=11.6, cy=4.6, w=1.0, h=0.5, kind='c')),
    ])

# ---------------- XIAO ESP32S3 / RP2040 / SAMD21 (тот же форм-фактор 21 x 17.8 мм, выводы те же) ----------------
XL = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']


def xiao(title, chip, bottom, side_leds):
    return dict(
        W=17.8, H=21, mask='black', radius=1.2, title=title, pin_silk=False,
        pins=col('L', 1.0, 2.75, XL, 'r') + col('R', 16.8, 2.75, XCR, 'l'),
        comps=[('usbc', dict(cx=8.9, edge=-0.9, side='t')),
               ('shieldbox', dict(cx=8.9, cy=11.2, w=10.6, h=8.8, text=chip)),
               ('text', dict(x=8.9, y=15.4, t='XIAO', size=0.7))] + bottom + side_leds)


BOARDS['xiao-esp32s3'] = xiao('XIAO ESP32S3', 'ESP32-S3', [
    ('btn', dict(cx=4.6, cy=18.4, small=True)), ('btn', dict(cx=13.2, cy=18.4, small=True)),
    ('smd', dict(cx=8.9, cy=18.0, w=2.4, h=2.4, kind='c')),
], [('smd', dict(cx=4.2, cy=6.8, w=1.0, h=0.5, kind='c'))])
BOARDS['xiao-rp2040'] = xiao('XIAO RP2040', 'RP2040', [
    ('btn', dict(cx=4.6, cy=18.4, small=True)), ('btn', dict(cx=13.2, cy=18.4, small=True)),
    ('smd', dict(cx=8.9, cy=18.0, w=2.4, h=2.0, kind='c')),
], [('led', dict(cx=14.6, cy=5.0, color='red')), ('smd', dict(cx=4.2, cy=6.8, w=1.0, h=0.5, kind='c'))])
BOARDS['xiao-samd21'] = xiao('XIAO SAMD21', 'SAMD21', [
    ('led', dict(cx=5.0, cy=18.6, color='blue')), ('led', dict(cx=8.9, cy=18.6, color='green')), ('led', dict(cx=12.8, cy=18.6, color='red')),
    ('smd', dict(cx=4.2, cy=6.8, w=1.0, h=0.5, kind='c')),
], [('smd', dict(cx=13.6, cy=7.4, w=1.0, h=0.5, kind='r'))])

# ---------------- Pro Micro (ATmega32U4, 33.02 x 17.78, 2 x 12 выводов) ----------------
PML = ['D1|TXO', 'D0|RXI', 'GND', 'GND', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9']
PMR = ['RAW', 'GND', 'RST', 'VCC', 'A3', 'A2', 'A1', 'A0', 'D15', 'D14', 'D16', 'D10']
BOARDS['pro-micro'] = dict(
    W=17.78, H=33.02, mask='red', radius=0.8, title='Pro Micro',
    pins=col('L', 1.27, 2.54, [t.split('|')[-1] for t in PML], 'r') + col('R', 16.51, 2.54, PMR, 'l'),
    comps=[
        ('micro', dict(cx=8.89, edge=-1.4, side='t')),
        ('qfp', dict(cx=8.89, cy=16.0, body=7.0, pins=11, rot=45, text='ATMEGA\n32U4')),
        ('xtal', dict(cx=8.89, cy=25.0, w=3.6, h=2.2, text='16M')),
        ('led', dict(cx=5.2, cy=9.2, color='red')), ('led', dict(cx=12.6, cy=9.2, color='green')),
        ('sot223', dict(cx=8.89, cy=29.4, rot=0, small=True)),
        ('smd', dict(cx=5.4, cy=22.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=12.4, cy=22.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=5.6, cy=11.8, w=1.0, h=0.5, kind='c')),
    ])


# ---------------- Arduino Zero (формат Uno: те же гребёнки и габариты 68.58 x 53.34) ----------------
import boards2  # noqa: E402

_uno = boards2.BOARDS['uno']
BOARDS['zero'] = dict(
    _uno, title='Arduino Zero',
    comps=[c for c in _uno['comps'] if c[0] in ('fheader', 'hole')] + [
        ('micro', dict(cx=0, edge=-1.4, side='l', cy=9.0)), ('micro', dict(cx=0, edge=-1.4, side='l', cy=21.4)),
        ('dcjack', dict(cx=3.2, cy=46.2, w=14.4, h=9.0)),
        ('qfp', dict(cx=40.0, cy=26.5, body=7.0, pins=12, rot=0, text='SAMD21\nG18A')),
        ('qfp', dict(cx=24.0, cy=30.0, body=7.0, pins=12, rot=0, text='EDBG')),
        ('xtal', dict(cx=29.8, cy=21.4, w=3.6, h=2.2, text='32.768K')),
        ('btn2', dict(cx=7.0, cy=33.8)),
        ('icsp', dict(cx=56.0, cy=26.0)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('led', dict(cx=31.6, cy=13.8, color='green')), ('led', dict(cx=31.6, cy=16.6, color='green')), ('led', dict(cx=31.6, cy=19.4, color='red')),
        ('smd', dict(cx=36.0, cy=14.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=36.0, cy=17.2, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=46.0, cy=36.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=28.6, cy=47.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=47.0, y=40.0, t='ZERO', size=2.2)),
    ])
