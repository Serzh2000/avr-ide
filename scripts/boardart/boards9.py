# Платы четвёртой волны, часть 2: NodeMCU-32S, ESP8684-DevKitM-1, ESP32-H2-DevKitM-1, Arduino Nano Matter.
# Единицы — мм, начало — левый верхний угол платы, ось y вниз. Порядок выводов — по официальным документам производителей;
# габариты Espressif DevKitM и положение мелочи — приблизительные.
from boards import col
from boards3 import NANO_Y0

BOARDS = {}

# ---------------- NodeMCU-32S (Ai-Thinker NodeMCU-32; 25.4 x 48.3 в спецификации — сетка выводов, габариты платы оценены по фото) ----------------
NML = ['3V3', 'EN', 'SVP', 'SVN', 'P34', 'P35', 'P32', 'P33', 'P25', 'P26', 'P27', 'P14', 'P12', 'GND', 'P13', 'SD2', 'SD3', 'CMD', '5V']
NMR = ['GND', 'P23', 'P22', 'TX', 'RX', 'P21', 'GND', 'P19', 'P18', 'P5', 'P17', 'P16', 'P4', 'P0', 'P2', 'P15', 'SD1', 'SD0', 'CLK']
BOARDS['nodemcu-32s'] = dict(
    W=28.3, H=56.3, mask='black', radius=1.2, title='NodeMCU-32S',
    pins=col('L', 2.44, 7.4, NML, 'r') + col('R', 25.9, 7.4, NMR, 'l'),
    comps=[
        ('module', dict(x=6.1, y=0, w=16, h=23.0, ant=6.0, text=['ESP-32S'], pad_pitch=1.27)),
        ('micro', dict(cx=14.15, edge=56.9, side='b')),
        ('soic', dict(cx=12.4, cy=42.0, w=6.4, h=4.0, text='CP2102', pins=8)),
        ('sot223', dict(cx=19.4, cy=37.0, rot=0)),
        ('btn', dict(cx=6.8, cy=51.0)), ('btn', dict(cx=21.5, cy=51.0)),
        ('led', dict(cx=7.8, cy=32.4, color='blue')), ('led', dict(cx=7.8, cy=35.0, color='green')),
        ('smd', dict(cx=15.4, cy=33.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=9.0, cy=39.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=17.4, cy=46.4, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=14.15, y=26.4, t='NodeMCU-32S', size=1.1)),
        ('text', dict(x=6.8, y=53.8, t='EN', size=0.8)), ('text', dict(x=21.5, y=53.8, t='IO0', size=0.8)),
    ])

# ---------------- ESP8684-DevKitM-1 (габариты условные 25.4 x 52) ----------------
E2L = ['G', '3V3', '3V3', '2', '3', 'G', 'RST', 'G', '0', '1', '10', 'G', '5V', '5V', 'G']
E2R = ['G', 'TX', 'RX', 'G', '9', '8', 'G', '7', '6', '5', '4', 'G', '18', 'G', 'G']
BOARDS['esp8684-devkitm-1'] = dict(
    W=25.4, H=52, mask='black', radius=1.4, title='ESP8684-DevKitM-1',
    pins=col('L', 1.27, 6, E2L, 'r') + col('R', 24.13, 6, E2R, 'l'),
    comps=[
        ('module', dict(x=6.1, y=0, w=13.2, h=16.6, ant=4.6, text=['ESP8684-MINI-1', 'N4'], pad_pitch=0.8)),
        ('micro', dict(cx=12.7, edge=52.6, side='b')),
        ('qfn', dict(cx=8.6, cy=37.4, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=5.2, cy=45.4)), ('btn', dict(cx=20.2, cy=45.4)),
        ('led', dict(cx=6.2, cy=21.2, color='red')), ('rgb', dict(cx=18.6, cy=21.2)),
        ('sot223', dict(cx=17.2, cy=33.5, rot=0)),
        ('smd', dict(cx=12.6, cy=21.6, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=13.4, cy=27.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=8.2, cy=31.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=15.2, cy=40.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.7, y=24.8, t='ESP8684-DevKitM-1', size=1.0)),
        ('text', dict(x=5.2, y=48.2, t='BOOT', size=0.85)), ('text', dict(x=20.2, y=48.2, t='RST', size=0.85)),
    ])

# ---------------- ESP32-H2-DevKitM-1 (габариты условные 25.4 x 52, два USB-C) ----------------
H2L = ['3V3', 'RST', '0', '1', '2', '3', '13', '14', '4', '5', 'NC', 'VBAT', 'G', '5V', 'G']
H2R = ['G', 'TX', 'RX', '10', '11', '25', '12', '8', '22', 'G', '9', 'G', '27', '26', 'G']
BOARDS['esp32-h2-devkitm-1'] = dict(
    W=25.4, H=52, mask='black', radius=1.4, title='ESP32-H2-DevKitM-1',
    pins=col('L', 1.27, 6, H2L, 'r') + col('R', 24.13, 6, H2R, 'l'),
    comps=[
        ('module', dict(x=6.1, y=0, w=13.2, h=16.6, ant=4.6, text=['ESP32-H2-MINI-1', 'N4'], pad_pitch=0.8)),
        ('usbc', dict(cx=8.4, edge=52.5, side='b')), ('usbc', dict(cx=18.2, edge=52.5, side='b')),
        ('qfn', dict(cx=8.6, cy=36.4, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=5.2, cy=29.0)), ('btn', dict(cx=20.2, cy=29.0)),
        ('led', dict(cx=6.2, cy=21.2, color='red')), ('rgb', dict(cx=18.6, cy=21.2)),
        ('sot223', dict(cx=17.2, cy=35.5, rot=0)),
        ('smd', dict(cx=12.6, cy=21.6, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=13.4, cy=26.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=15.2, cy=40.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.7, y=24.4, t='ESP32-H2-DevKitM-1', size=0.9)),
        ('text', dict(x=5.2, y=31.8, t='BOOT', size=0.7)), ('text', dict(x=20.2, y=31.8, t='RST', size=0.7)),
    ])

# ---------------- Arduino Nano Matter (45 x 18, формат Nano) ----------------
NMTL = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'NC', 'GND', 'VIN']
NMTR = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'D1', 'D0']
BOARDS['nano-matter'] = dict(
    W=18, H=45, mask='teal', radius=1.0, title='Nano Matter',
    pins=col('L', 1.38, NANO_Y0, NMTL, 'r') + col('R', 16.62, NANO_Y0, NMTR, 'l'),
    comps=[
        ('usbc', dict(cx=9.0, edge=-2.0, side='t')),
        ('btn', dict(cx=9.0, cy=10.0, small=True)), ('btn', dict(cx=9.0, cy=17.0, small=True)),
        ('rgb', dict(cx=13.0, cy=13.4)),
        ('shieldbox', dict(cx=9.0, cy=33.5, w=12.8, h=14.0, text='MGM240S')),
        ('soic', dict(cx=4.6, cy=22.0, w=3.0, h=2.4, text='', pins=8)),
        ('led', dict(cx=5.4, cy=11.0, color='green')),
        ('smd', dict(cx=12.6, cy=21.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=5.4, cy=26.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=24.4, t='NANO MATTER', size=0.65)),
    ])


# ---------------- WeAct RP2040 (53 x 21.52 по чертежу производителя; ряды выводов через ≈ 17.7 мм — по масштабу рисунка) ----------------
WAL = ['GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND', 'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12', 'GP13', 'GND', 'GP14', 'GP15']
WAR = ['VBUS', 'VSYS', 'GND', '3V3', 'GP24', 'ADC_VREF', 'GP29', 'GND', 'GP28', 'GP27', 'GP26', 'GP22', 'GND', 'GP21', 'GP20', 'GP19', 'GP18', 'GND', 'GP17', 'GP16']
BOARDS['weact-rp2040'] = dict(
    W=21.52, H=53.0, mask='black', radius=1.2, title='WeAct RP2040', pin_silk=False,
    pins=col('L', 1.9, 2.0, WAL, 'r') + col('R', 19.62, 2.0, WAR, 'l'),
    comps=[
        ('usbc', dict(cx=10.76, edge=-0.9, side='t')),
        ('btn', dict(cx=7.6, cy=12.4, small=True)), ('btn', dict(cx=13.9, cy=12.4, small=True)),
        ('soic', dict(cx=10.76, cy=19.4, w=4.4, h=3.4, text='W25Q', pins=8)),
        ('qfn', dict(cx=10.76, cy=28.6, s=7.0, text='RP2040', pins=14)),
        ('xtal_sm', dict(cx=10.76, cy=37.2)),
        ('btn', dict(cx=15.4, cy=43.0, small=True)),
        ('led', dict(cx=6.4, cy=43.0, color='red')), ('led', dict(cx=8.6, cy=43.0, color='blue')),
        ('smd', dict(cx=12.4, cy=34.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=8.4, cy=24.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=10.76, y=8.6, t='RP2040', size=0.7)),
        ('text', dict(x=7.6, y=15.0, t='BOOTSEL', size=0.5)), ('text', dict(x=13.9, y=15.0, t='NRST', size=0.5)),
        ('text', dict(x=10.76, y=50.0, t='DEBUG', size=0.6)),
    ])
