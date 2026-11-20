# Описание плат для рендера (scripts/boardart/render.py). Единицы — мм, начало — левый верхний угол платы, ось y вниз.
# Размеры и расположение разъёмов, рядов выводов и крупных деталей — по официальной документации производителей
# (Espressif DevKit user guides, WeAct, STMicroelectronics UM1956/UM1724, AI-Thinker ESP-12E); мелочь (пассивные детали) — типовая.
# Координаты выводов (pins) берутся отсюда же: одни и те же числа рисуют площадки и попадают в данные слоя выводов.


def col(prefix, x, y0, labels, side, pitch=2.54):
    """Вертикальная гребёнка: side — куда смотрит шёлкография ('r' — вправо от площадки, 'l' — влево)."""
    return [dict(name=f'{prefix}:{i}', x=x, y=round(y0 + i * pitch, 3), silk=s, side=side) for i, s in enumerate(labels)]


def row(prefix, x0, y, labels, side, pitch=2.54):
    return [dict(name=f'{prefix}:{i}', x=round(x0 + i * pitch, 3), y=y, silk=s, side=side) for i, s in enumerate(labels)]


BOARDS = {}

# ---------------- ESP32-S3-DevKitC-1 (69 x 25.4) ----------------
S3L = ['3V3', '3V3', 'RST', '4', '5', '6', '7', '15', '16', '17', '18', '8', '3', '46', '9', '10', '11', '12', '13', '14', '5V', 'G']
S3R = ['G', 'TX', 'RX', '1', '2', '42', '41', '40', '39', '38', '37', '36', '35', '0', '45', '48', '47', '21', '20', '19', 'G', 'G']
BOARDS['esp32-s3'] = dict(
    W=25.4, H=69, mask='black', radius=1.4, title='ESP32-S3-DevKitC-1',
    pins=col('L', 1.27, 6, S3L, 'r') + col('R', 24.13, 6, S3R, 'l'),
    comps=[
        ('module', dict(x=3.7, y=0, w=18, h=25.5, ant=6.6, text=['ESP32-S3-WROOM-1', 'N8R2'], pad_pitch=1.27)),
        ('usbc', dict(cx=7.6, edge=69.5, side='b')), ('usbc', dict(cx=18.4, edge=69.5, side='b')),
        ('qfn', dict(cx=10.5, cy=54.6, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=4.9, cy=58.4)), ('btn', dict(cx=20.5, cy=58.4)),
        ('led', dict(cx=5.5, cy=27.9, color='red')), ('rgb', dict(cx=18.4, cy=29.0)),
        ('sot223', dict(cx=16.8, cy=48.6, rot=0)),
        ('smd', dict(cx=11.2, cy=28.3, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=14.7, cy=28.3, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=7.8, cy=46.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.8, cy=45.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=19.8, cy=45.0, w=2.0, h=1.2, kind='c')), ('smd', dict(cx=7.6, cy=58.2, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=15.0, cy=57.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=15.0, cy=59.2, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.7, y=41.2, t='ESP32-S3-DevKitC-1', size=1.15)),
        ('text', dict(x=12.7, y=42.8, t='v1.1', size=0.9)),
        ('text', dict(x=4.9, y=61.0, t='BOOT', size=0.8)), ('text', dict(x=20.5, y=61.0, t='RST', size=0.8)),
        ('text', dict(x=9.6, y=60.8, t='UART', size=0.9)), ('text', dict(x=16.2, y=60.8, t='USB', size=0.9)),
        ('text', dict(x=5.5, y=30.0, t='PWR', size=0.8)), ('text', dict(x=18.4, y=31.6, t='RGB', size=0.8)),
    ])

# ---------------- ESP32-C3-DevKitM-1 (~51 x 25.4) ----------------
C3L = ['G', '3V3', '3V3', '2', '3', 'G', 'RST', 'G', '0', '1', '10', 'G', '5V', '5V', 'G']
C3R = ['G', 'TX', 'RX', 'G', '9', '8', 'G', '7', '6', '5', '4', 'G', '18', '19', 'G']
BOARDS['esp32-c3'] = dict(
    W=25.4, H=52, mask='black', radius=1.4, title='ESP32-C3-DevKitM-1',
    pins=col('L', 1.27, 6, C3L, 'r') + col('R', 24.13, 6, C3R, 'l'),
    comps=[
        ('module', dict(x=6.1, y=0, w=13.2, h=16.6, ant=4.6, text=['ESP32-C3-MINI-1', 'N4'], pad_pitch=0.8)),
        ('micro', dict(cx=12.7, edge=52.6, side='b')),
        ('qfn', dict(cx=8.6, cy=37.4, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=5.2, cy=45.4)), ('btn', dict(cx=20.2, cy=45.4)),
        ('led', dict(cx=6.2, cy=21.2, color='red')), ('rgb', dict(cx=18.6, cy=21.2)),
        ('sot223', dict(cx=17.2, cy=33.5, rot=0)),
        ('smd', dict(cx=12.6, cy=21.6, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=13.4, cy=27.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=8.2, cy=31.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=15.2, cy=40.4, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=11.6, cy=42.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=18.4, cy=27.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=12.7, y=24.8, t='ESP32-C3-DevKitM-1', size=1.05)),
        ('text', dict(x=5.2, y=48.2, t='BOOT', size=0.85)), ('text', dict(x=20.2, y=48.2, t='RST', size=0.85)),
        ('text', dict(x=6.2, y=23.0, t='PWR', size=0.8)), ('text', dict(x=18.6, y=23.4, t='RGB', size=0.8)),
    ])

# ---------------- ESP32-C3 SuperMini (22.5 x 18) ----------------
SML = ['5V', 'G', '3V3', '4', '3', '2', '1', '0']
SMR = ['5', '6', '7', '8', '9', '10', '20', '21']
BOARDS['esp32-c3-supermini'] = dict(
    W=18, H=22.5, mask='black', radius=1.2, title='C3 SuperMini',
    pins=col('L', 1.37, 3.5, SML, 'r') + col('R', 16.63, 3.5, SMR, 'l'),
    comps=[
        ('usbc', dict(cx=9.0, edge=-0.7, side='t')),
        ('btn', dict(cx=5.2, cy=9.2, small=True)), ('btn', dict(cx=12.8, cy=9.2, small=True)),
        ('qfn', dict(cx=9.0, cy=14.6, s=5, text='ESP32\nC3FH4', pins=7, shield=True)),
        ('ceramic_ant', dict(cx=9.0, cy=20.2, w=6.0, h=1.6)),
        ('led', dict(cx=4.6, cy=18.0, color='blue')), ('led', dict(cx=13.4, cy=18.0, color='red')),
        ('soic', dict(cx=13.2, cy=12.8, w=3, h=1.6, sot=True)),
        ('smd', dict(cx=5.4, cy=14.4, w=1.0, h=0.5, kind='c', rot=90)), ('smd', dict(cx=12.8, cy=16.4, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=9.0, cy=18.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=5.2, y=11.2, t='RST', size=0.75)), ('text', dict(x=12.8, y=11.2, t='BOOT', size=0.75)),
    ])

# ---------------- ESP32 DevKitC V4 (54.4 x 27.9, 38 pin) ----------------
DKL = ['3V3', 'EN', 'VP', 'VN', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND', '13', 'SD2', 'SD3', 'CMD', '5V']
DKR = ['GND', '23', '22', 'TX', 'RX', '21', 'GND', '19', '18', '5', '17', '16', '4', '0', '2', '15', 'SD1', 'SD0', 'CLK']
BOARDS['esp32-devkitc'] = dict(
    W=27.9, H=54.4, mask='black', radius=1.4, title='ESP32-DevKitC V4',
    pins=col('L', 1.25, 4, DKL, 'r') + col('R', 26.65, 4, DKR, 'l'),
    comps=[
        ('module', dict(x=4.95, y=0, w=18, h=25.5, ant=6.6, text=['ESP32-WROOM-32E', '8MB'], pad_pitch=1.27)),
        ('micro', dict(cx=14.0, edge=55.0, side='b')),
        ('qfn', dict(cx=9.6, cy=36.2, s=5, text='CP2102N', pins=7)),
        ('btn', dict(cx=5.8, cy=49.4)), ('btn', dict(cx=22.4, cy=49.4)),
        ('led', dict(cx=6.4, cy=29.4, color='red')),
        ('sot223', dict(cx=19.8, cy=36.6, rot=0)),
        ('smd', dict(cx=14.2, cy=29.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=15.8, cy=33.2, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=5.8, cy=39.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=14.2, cy=41.4, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=19.4, cy=42.6, w=2.0, h=1.2, kind='c')), ('smd', dict(cx=10.4, cy=44.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=14.0, y=28.2, t='ESP32-DevKitC', size=1.0)),
        ('text', dict(x=5.8, y=46.6, t='BOOT', size=0.85)), ('text', dict(x=22.4, y=46.6, t='EN', size=0.85)),
    ])

# ---------------- NodeMCU v2 Amica (~49 x 25.4) ----------------
NML = ['A0', 'RSV', 'RSV', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN']
NMR = ['D0', 'D1', 'D2', 'D3', 'D4', '3V3', 'GND', 'D5', 'D6', 'D7', 'D8', 'RX', 'TX', 'GND', '3V3']
BOARDS['nodemcu-v2'] = dict(
    W=25.4, H=49, mask='black', radius=1.2, title='NodeMCU v2 Amica',
    pins=col('L', 1.27, 6.5, NML, 'r') + col('R', 24.13, 6.5, NMR, 'l'),
    comps=[
        ('module', dict(x=4.7, y=-0.5, w=16, h=24, ant=6.2, text=['ESP-12E'], pad_pitch=2.0, shield_inset=2.0, pads_n=8)),
        ('micro', dict(cx=12.7, edge=49.6, side='b')),
        ('qfn', dict(cx=12.7, cy=34.8, s=5, text='CP2102', pins=7)),
        ('btn', dict(cx=4.4, cy=45.2)), ('btn', dict(cx=21.0, cy=45.2)),
        ('led', dict(cx=5.0, cy=27.4, color='blue')), ('led', dict(cx=20.2, cy=27.4, color='blue')),
        ('sot223', dict(cx=12.7, cy=29.4, rot=0)),
        ('smd', dict(cx=7.6, cy=33.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=17.6, cy=33.4, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=8.6, cy=39.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=16.8, cy=39.4, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.7, y=25.2, t='NodeMCU', size=1.2)),
        ('text', dict(x=4.4, y=42.2, t='RST', size=0.85)), ('text', dict(x=21.0, y=42.2, t='FLASH', size=0.85)),
    ])

# ---------------- NodeMCU v3 LoLin (58 x 31) ----------------
BOARDS['nodemcu-v3'] = dict(
    W=31, H=58, mask='black_blue', radius=1.2, title='NodeMCU v3 LoLin',
    pins=col('L', 1.53, 8.5, ['A0', 'GND', 'VU', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN'], 'r')
    + col('R', 29.47, 8.5, NMR, 'l'),
    comps=[
        ('module', dict(x=7.5, y=-0.5, w=16, h=24, ant=6.2, text=['ESP-12E'], pad_pitch=2.0, shield_inset=2.0, pads_n=8)),
        ('micro', dict(cx=15.5, edge=58.6, side='b')),
        ('soic', dict(cx=15.5, cy=42.6, w=6.4, h=4.0, text='CH340G', pins=8)),
        ('btn', dict(cx=5.8, cy=53.4)), ('btn', dict(cx=25.2, cy=53.4)),
        ('led', dict(cx=7.5, cy=28.4, color='blue')), ('led', dict(cx=23.5, cy=28.4, color='blue')),
        ('sot223', dict(cx=15.5, cy=32.6, rot=0)),
        ('xtal_sm', dict(cx=15.5, cy=48.6)),
        ('smd', dict(cx=9.6, cy=37.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=21.4, cy=37.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=10.6, cy=45.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=20.6, cy=45.6, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=15.5, y=26.2, t='NodeMCU', size=1.4)),
        ('text', dict(x=5.8, y=50.4, t='RST', size=0.85)), ('text', dict(x=25.2, y=50.4, t='FLASH', size=0.85)),
    ])

# ---------------- Blue Pill (STM32F103C8T6, 53 x 22.8) ----------------
PILL_TOP = ['G', 'G', '3.3', 'R', 'B11', 'B10', 'B1', 'B0', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'C15', 'C14', 'C13', 'VB']
PILL_BOT = ['B12', 'B13', 'B14', 'B15', 'A8', 'A9', 'A10', 'A11', 'A12', 'A15', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', '5V', 'G', '3.3']
SWDL = ['3.3', 'DIO', 'CLK', 'GND']
BOARDS['bluepill'] = dict(
    W=53, H=22.8, mask='blue', radius=1.0, title='Blue Pill',
    pins=row('t', 2.37, 2.51, PILL_TOP, 'b') + row('b', 2.37, 20.29, PILL_BOT, 't') + col('swd', 51.65, 7.59, SWDL, 'l'),
    comps=[
        ('micro', dict(cx=0.0, edge=-1.8, side='l', cy=11.4)),
        ('btn', dict(cx=9.8, cy=14.0)),
        ('jumper', dict(cx=14.4, cy=8.0)), ('jumper', dict(cx=18.6, cy=8.0)),
        ('soic', dict(cx=24.0, cy=9.4, w=4.2, h=3.4, text='662K', pins=0, sot=True)),
        ('qfp', dict(cx=31.5, cy=11.4, body=7.0, pins=12, rot=45, text='STM32\nF103C8T6')),
        ('xtal', dict(cx=39.6, cy=11.4, w=4.8, h=3.6, text='8.000')),
        ('xtal_sm', dict(cx=44.8, cy=11.4, vertical=True)),
        ('pinheader', dict(cx=51.65, cy=11.4, n=4, vertical=True)),
        ('led', dict(cx=15.2, cy=14.8, color='red')), ('led', dict(cx=46.2, cy=15.2, color='green')),
        ('smd', dict(cx=20.8, cy=14.8, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=22.4, cy=14.8, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=33.0, cy=16.6, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=36.0, cy=16.6, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=42.0, cy=15.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=24.0, cy=14.8, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=9.8, y=11.2, t='RESET', size=0.85)),
        ('text', dict(x=14.4, y=12.9, t='BOOT0', size=0.65)), ('text', dict(x=18.6, y=12.9, t='BOOT1', size=0.65)),
        ('text', dict(x=15.2, y=16.6, t='PWR', size=0.7)), ('text', dict(x=46.2, y=17.0, t='PC13', size=0.7)),
    ])

# ---------------- Black Pill (WeAct STM32F411CEU6, 52.81 x 20.78) ----------------
BLACK_TOP = ['5V', 'G', '3.3', 'B10', 'B2', 'B1', 'B0', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'R', 'C15', 'C14', 'C13', 'VB']
BOARDS['blackpill'] = dict(
    W=52.81, H=20.78, mask='black', radius=1.0, title='Black Pill',
    pins=row('t', 2.27, 1.5, BLACK_TOP, 'b') + row('b', 2.27, 19.28, PILL_BOT, 't') + col('swd', 50.85, 6.59, SWDL, 'l'),
    comps=[
        ('usbc', dict(cx=0.0, edge=-0.3, side='l', cy=10.4)),
        ('btn', dict(cx=12.4, cy=8.4, small=True)), ('btn', dict(cx=16.8, cy=8.4, small=True)), ('btn', dict(cx=21.2, cy=8.4, small=True)),
        ('qfn', dict(cx=29.0, cy=10.4, s=7, text='STM32\nF411CEU6', pins=12)),
        ('xtal', dict(cx=37.6, cy=8.4, w=3.2, h=2.5, text='25M')),
        ('soic', dict(cx=40.4, cy=12.6, w=4.4, h=3.0, text='25Q', pins=8)),
        ('pinheader', dict(cx=50.85, cy=10.4, n=4, vertical=True)),
        ('led', dict(cx=34.6, cy=15.6, color='red')), ('led', dict(cx=38.0, cy=15.6, color='blue')),
        ('sot223', dict(cx=11.6, cy=14.4, rot=0, small=True)),
        ('smd', dict(cx=15.0, cy=14.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=18.0, cy=14.4, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=24.6, cy=15.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=44.2, cy=15.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=12.4, y=11.0, t='NRST', size=0.7)), ('text', dict(x=16.8, y=11.0, t='BOOT0', size=0.7)), ('text', dict(x=21.2, y=11.0, t='KEY', size=0.7)),
        ('text', dict(x=26.0, y=16.4, t='BLACK PILL', size=1.0)),
        ('text', dict(x=34.6, y=17.4, t='PWR', size=0.65)), ('text', dict(x=38.0, y=17.4, t='C13', size=0.65)),
    ])

# ---------------- NUCLEO-L432KC (Nucleo-32, 43.18 x 18.5) ----------------
NK_TOP = ['VIN', 'GND', 'RST', '5V', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'REF', '3V3', 'D13']
NK_BOT = ['D1', 'D0', 'RST', 'GND', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12']
BOARDS['nucleo32'] = dict(
    W=43.18, H=18.5, mask='white', radius=0.9, title='NUCLEO-L432KC',
    pins=row('t', 3.81, 1.63, NK_TOP, 'b') + row('b', 3.81, 16.87, NK_BOT, 't'),
    comps=[
        ('micro', dict(cx=0.0, edge=-1.8, side='l', cy=9.25)),
        ('qfp', dict(cx=12.4, cy=9.25, body=7.0, pins=12, rot=0, text='STM32\nF103CBT6')),
        ('xtal', dict(cx=19.6, cy=9.25, w=3.4, h=2.6, text='8.0')),
        ('qfn', dict(cx=31.5, cy=9.25, s=5, text='STM32\nL432KC', pins=8)),
        ('btn', dict(cx=25.4, cy=13.3)),
        ('led', dict(cx=18.6, cy=5.6, color='green')), ('led', dict(cx=22.6, cy=5.6, color='red')), ('led', dict(cx=26.6, cy=5.6, color='green')),
        ('smd', dict(cx=8.2, cy=5.2, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=8.2, cy=13.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=15.6, cy=14.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=27.6, cy=13.8, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=36.4, cy=13.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=36.4, cy=5.6, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=38.0, y=9.0, t='NUCLEO', size=1.0, c='blue')), ('text', dict(x=38.0, y=10.5, t='L432KC', size=1.0, c='blue')),
        ('text', dict(x=25.4, y=10.7, t='RESET', size=0.7, c='blue')),
        ('text', dict(x=18.6, y=7.0, t='LD3', size=0.6, c='blue')),
    ])


def named(names, x, y0, side, pitch=2.54):
    """Гребёнка с произвольными именами выводов (имена используются в boardLayouts)."""
    return [dict(name=n, x=x, y=round(y0 + i * pitch, 3), silk=n.split('.')[0].lstrip('D') if n.startswith('D') and n[1:].isdigit() else n.split('.')[0], side=side) for i, n in enumerate(names)]


# ---------------- WeMos D1 mini (34.2 x 25.6) ----------------
BOARDS['wemos-d1-mini'] = dict(
    W=25.6, H=34.2, mask='black', radius=1.0, title='WeMos D1 mini',
    pins=named(['RST', 'A0', 'D0', 'D5', 'D6', 'D7', 'D8', '3V3'], 1.37, 7.267, 'r') + named(['TX', 'RX', 'D1', 'D2', 'D3', 'D4', 'G', '5V'], 24.23, 7.267, 'l'),
    comps=[
        ('module', dict(x=4.8, y=-0.4, w=16, h=24, ant=6.2, text=['ESP-12F'], pad_pitch=2.0, shield_inset=2.0, pads_n=8)),
        ('micro', dict(cx=12.8, edge=35.2, side='b')),
        ('soic', dict(cx=12.8, cy=27.4, w=4.2, h=3.0, text='CH340', pins=16, pitch=0.8)),
        ('sot223', dict(cx=19.6, cy=29.6, rot=0, small=True)),
        ('btn', dict(cx=5.0, cy=30.2, small=True)),
        ('led', dict(cx=7.6, cy=27.0, color='blue')),
        ('smd', dict(cx=16.4, cy=26.4, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=8.6, cy=29.6, w=1.0, h=0.5, kind='c')),
    ])

# ---------------- ESP32 DevKit V1 (30 pin, ~52 x 28.2) ----------------
BOARDS['esp32-devkit'] = dict(
    W=28.2, H=52, mask='black', radius=1.4, title='ESP32 DevKit V1',
    pins=named(['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND.2', 'VIN'], 1.3, 6.325, 'r')
    + named(['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND.1', '3V3'], 26.7, 6.325, 'l'),
    comps=[
        ('module', dict(x=5.1, y=0, w=18, h=25.5, ant=6.6, text=['ESP32-WROOM-32', '4MB'], pad_pitch=1.27)),
        ('micro', dict(cx=14.1, edge=52.8, side='b')),
        ('qfn', dict(cx=9.6, cy=36.6, s=5, text='CP2102', pins=7)),
        ('btn', dict(cx=5.6, cy=47.4)), ('btn', dict(cx=22.6, cy=47.4)),
        ('led', dict(cx=20.8, cy=29.0, color='blue')),
        ('sot223', dict(cx=19.6, cy=37.6, rot=0)),
        ('smd', dict(cx=14.2, cy=29.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=15.6, cy=33.4, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=6.4, cy=41.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=14.0, cy=41.8, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=19.6, cy=43.4, w=2.0, h=1.2, kind='c')), ('smd', dict(cx=10.4, cy=43.6, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=14.1, y=28.4, t='ESP32 DevKit', size=1.0)),
        ('text', dict(x=5.6, y=44.6, t='BOOT', size=0.85)), ('text', dict(x=22.6, y=44.6, t='EN', size=0.85)),
    ])
