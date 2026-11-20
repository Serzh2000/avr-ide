# Платы четвёртой волны: ESP32-C3-DevKitC-02, ESP32-S3-DevKitM-1, Teensy LC, Adafruit ItsyBitsy M0 Express / nRF52840, Trinket M0.
# Единицы — мм, начало — левый верхний угол платы, ось y вниз. Порядок выводов — по официальным документам производителей;
# габариты и положение мелочи приблизительные (отмечено в заметках плат).
from boards import col, row

BOARDS = {}

# ---------------- ESP32-C3-DevKitC-02 (габариты условные 25.4 x 52) ----------------
C3L = ['G', '3V3', '3V3', 'RST', 'G', '4', '5', '6', '7', 'G', '8', '9', '5V', '5V', 'G']
C3R = ['G', '0', '1', '2', '3', 'G', '10', 'G', 'RX', 'TX', 'G', '18', '19', 'G', 'G']
BOARDS['esp32-c3-devkitc-02'] = dict(
    W=25.4, H=52, mask='black', radius=1.4, title='ESP32-C3-DevKitC-02',
    pins=col('L', 1.27, 6, C3L, 'r') + col('R', 24.13, 6, C3R, 'l'),
    comps=[
        ('module', dict(x=3.7, y=0, w=18, h=20.0, ant=6.0, text=['ESP32-C3-WROOM-02', 'N4'], pad_pitch=1.27)),
        ('micro', dict(cx=12.7, edge=52.6, side='b')),
        ('qfn', dict(cx=8.6, cy=37.4, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=5.2, cy=45.4)), ('btn', dict(cx=20.2, cy=45.4)),
        ('led', dict(cx=6.2, cy=23.6, color='red')), ('rgb', dict(cx=18.6, cy=23.6)),
        ('sot223', dict(cx=17.2, cy=33.5, rot=0)),
        ('smd', dict(cx=12.6, cy=24.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=8.2, cy=31.6, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=15.2, cy=40.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=11.6, cy=42.4, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=12.7, y=27.6, t='ESP32-C3-DevKitC-02', size=0.95)),
        ('text', dict(x=5.2, y=48.2, t='BOOT', size=0.85)), ('text', dict(x=20.2, y=48.2, t='RST', size=0.85)),
    ])

# ---------------- ESP32-S3-DevKitM-1 (габариты условные 25.4 x 68) ----------------
S3L = ['3V3'] + [str(i) for i in range(0, 19)] + ['5V', 'G']
S3R = ['G', 'RST', '46', '45', 'RX', 'TX', '42', '41', '40', '39', '38', '37', '36', '35', '34', '33', '26', '21', '20', '19', '48', '47']
BOARDS['esp32-s3-devkitm-1'] = dict(
    W=25.4, H=68, mask='black', radius=1.4, title='ESP32-S3-DevKitM-1',
    pins=col('L', 1.27, 6, S3L, 'r') + col('R', 24.13, 6, S3R, 'l'),
    comps=[
        ('module', dict(x=5.0, y=0, w=15.4, h=20.5, ant=5.8, text=['ESP32-S3-MINI-1', 'N8'], pad_pitch=0.8)),
        ('micro', dict(cx=8.6, edge=68.6, side='b')), ('micro', dict(cx=18.0, edge=68.6, side='b')),
        ('qfn', dict(cx=10.5, cy=54.0, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=4.9, cy=59.0)), ('btn', dict(cx=20.5, cy=59.0)),
        ('led', dict(cx=5.5, cy=24.0, color='red')), ('rgb', dict(cx=18.4, cy=24.0)),
        ('sot223', dict(cx=16.8, cy=48.6, rot=0)),
        ('smd', dict(cx=11.2, cy=24.6, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=7.8, cy=46.6, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=13.8, cy=45.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=19.8, cy=45.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=12.7, y=29.0, t='ESP32-S3-DevKitM-1', size=1.0)),
        ('text', dict(x=4.9, y=62.0, t='BOOT', size=0.8)), ('text', dict(x=20.5, y=62.0, t='RST', size=0.8)),
    ])

# ---------------- Teensy LC (35.56 x 17.78, 2 x 14 выводов; размеры по стандарту DIP-28, приблизительно) ----------------
TLT = ['VIN', 'GND', '3V3', '23', '22', '21', '20', '19', '18', '17', '16', '15', '14', '13']
TLB = ['GND', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
BOARDS['teensy-lc'] = dict(
    W=35.56, H=17.78, mask='green', radius=0.8, title='Teensy LC',
    pins=row('t', 1.27, 1.27, TLT, 'b') + row('b', 1.27, 16.51, TLB, 't'),
    comps=[
        ('micro', dict(cx=0.0, edge=-1.6, side='l', cy=8.89)),
        ('qfp', dict(cx=19.0, cy=8.89, body=7.0, pins=8, rot=45, text='MKL26Z64')),
        ('btn', dict(cx=30.0, cy=8.4, small=True)),
        ('xtal_sm', dict(cx=11.0, cy=12.4)),
        ('soic', dict(cx=8.0, cy=5.4, w=2.6, h=2.6, text='', pins=0, sot=True)),
        ('soic', dict(cx=11.6, cy=6.0, w=3.0, h=2.4, text='', pins=8)),
        ('led', dict(cx=31.6, cy=13.0, color='red')),
        ('smd', dict(cx=25.0, cy=14.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=27.0, cy=4.6, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=7.0, cy=12.0, w=1.0, h=0.5, kind='r')),
    ])

# ---------------- Adafruit ItsyBitsy M0 Express / nRF52840 (36 x 18, выводы через 12.7 мм; по масштабу рисунка) ----------------
IMR = ['VBAT', 'GND', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D7', 'D5', 'SCL', 'SDA', 'D1', 'D0']
IML = ['RESET', '3V3', 'AREF', 'VHI', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'D2']
BOARDS['itsybitsy-m0-express'] = dict(
    W=18.0, H=36.0, mask='black', radius=1.0, title='ItsyBitsy M0 Express', pin_silk=False,
    pins=col('L', 2.65, 1.6, IML, 'r') + col('R', 15.35, 1.6, IMR, 'l'),
    comps=[
        ('micro', dict(cx=9.0, edge=-1.2, side='t')),
        ('qfp', dict(cx=9.0, cy=19.0, body=7.0, pins=12, rot=0, text='SAMD21')),
        ('soic', dict(cx=9.0, cy=27.0, w=3.2, h=2.6, text='', pins=8)),
        ('btn', dict(cx=6.4, cy=30.8, small=True)), ('btn', dict(cx=11.6, cy=30.8, small=True)),
        ('rgb', dict(cx=9.0, cy=10.4)),
        ('smd', dict(cx=5.0, cy=22.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.0, cy=14.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=33.6, t='ITSYBITSY M0', size=0.55)),
    ])
INL = ['RESET', '3V3', 'EN', 'VHI', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'D2']
BOARDS['itsybitsy-nrf52840'] = dict(
    W=18.0, H=36.0, mask='blue', radius=1.0, title='ItsyBitsy nRF52840', pin_silk=False,
    pins=col('L', 2.65, 1.6, INL, 'r') + col('R', 15.35, 1.6, IMR, 'l'),
    comps=[
        ('micro', dict(cx=9.0, edge=-1.2, side='t')),
        ('shieldbox', dict(cx=9.0, cy=23.5, w=9.0, h=12.6, text='nRF52840')),
        ('antenna', dict(cx=9.0, cy=32.2, w=7.0, h=2.6, n=3)),
        ('btn', dict(cx=6.2, cy=8.2, small=True)), ('btn', dict(cx=11.8, cy=8.2, small=True)),
        ('rgb', dict(cx=9.0, cy=13.4)),
        ('smd', dict(cx=5.0, cy=14.5, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.0, cy=15.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=16.8, t='ITSYBITSY', size=0.55)),
    ])

# ---------------- Adafruit Trinket M0 (по масштабу рисунка ≈ 15 x 24.6, ряды через 12.7 мм) ----------------
BOARDS['trinket-m0'] = dict(
    W=15.0, H=24.6, mask='black', radius=1.0, title='Trinket M0', pin_silk=False,
    pins=col('L', 1.15, 8.7, ['VBAT', 'GND', 'D4', 'D3', 'RESET'], 'r') + col('R', 13.85, 8.7, ['VBUS', 'D0', 'D1', 'D2', '3V3'], 'l'),
    comps=[
        ('micro', dict(cx=7.5, edge=-1.2, side='t')),
        ('qfn', dict(cx=7.5, cy=14.5, s=5.0, text='SAMD21', pins=7)),
        ('btn', dict(cx=7.5, cy=21.4, small=True)),
        ('rgb', dict(cx=7.5, cy=8.0)),
        ('led', dict(cx=4.0, cy=5.0, color='red')),
        ('smd', dict(cx=4.4, cy=17.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=10.6, cy=18.0, w=1.0, h=0.5, kind='r')),
    ])
