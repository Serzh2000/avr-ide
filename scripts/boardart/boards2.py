# Платы, ранее нарисованные Wokwi / Fritzing / Raspberry Pi: Uno, Nano, Mega, Leonardo, Pro Mini, Pico (3 шт.), Nucleo-64.
# Положение выводов — прежние координаты слоя выводов (legacy_pins.json: данные из прежних рисунков, то есть сохранены как были),
# поэтому слой выводов в приложении не менялся. Все детали — собственные 3D-модели; логотипов и товарных знаков нет.
# Координаты деталей — в системе МОДЕЛИ: мм от левого верхнего угла платы (ось y вниз); выводы — в координатах слоя (k, off).
import json
import os

LEG = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'legacy_pins.json'), encoding='utf8'))
BOARDS = {}


def lp(art):
    return {n: tuple(v) for n, v in LEG[art]['pins'].items()}


def pins_of(art, k=1.0, silk=None):
    return [dict(name=n, x=v[0], y=v[1], silk='', side='b') for n, v in LEG[art]['pins'].items()]


def mod(art, names, k=1.0, off=(0.0, 0.0)):
    """Центры выводов по именам в координатах модели."""
    P = lp(art)
    return [(P[n][0] / k - off[0], P[n][1] / k - off[1]) for n in names]


def strip(art, names, extra_before=0, k=1.0, off=(0.0, 0.0)):
    pts = mod(art, names, k, off)
    if extra_before:
        x, y = pts[0]
        pts = [(x - 2.54 * (i + 1), y) for i in reversed(range(extra_before))] + pts
    return dict(pts=pts)


def smd(x, y, kind='r', w=1.0, h=0.5, rot=0):
    return ('smd', dict(cx=x, cy=y, w=w, h=h, kind=kind, rot=rot))


def smd_cluster(pts):
    return [smd(x, y, 'c' if i % 2 else 'r') for i, (x, y) in enumerate(pts)]


UNO_HOLES = [(15.3, 2.5), (14.0, 50.8), (66.04, 17.8), (66.04, 45.7)]

# ---------------- Arduino Uno R3 ----------------
D_TOP1 = ['A5.2', 'A4.2', 'AREF', 'GND.1', '13', '12', '11', '10', '9', '8']
D_TOP2 = ['7', '6', '5', '4', '3', '2', '1', '0']
BOARDS['uno'] = dict(
    W=68.58, H=53.34, mask='teal', radius=1.0, outline='uno', title='Arduino Uno R3', pin_silk=False,
    pins=pins_of('uno'),
    comps=[
        ('fheader', strip('uno', D_TOP1)), ('fheader', strip('uno', D_TOP2)),
        ('fheader', strip('uno', ['IOREF', 'RESET', '3.3V', '5V', 'GND.2', 'GND.3', 'VIN'], extra_before=1)),
        ('fheader', strip('uno', ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'])),
        ('usbb', dict(cx=0, cy=15.3, x0=-6.0, x1=10.5)),
        ('dcjack', dict(cx=3.2, cy=46.2, w=14.4, h=9.0)),
        ('dip', dict(cx=46.8, cy=37.2, w=34.5, h=7.0, text='ATMEGA328P-PU', pins=14)),
        ('qfn', dict(cx=22.0, cy=27.0, s=5, text='16U2', pins=7)),
        ('xtal', dict(cx=24.6, cy=20.4, w=4.8, h=3.6, text='16.000')),
        ('btn2', dict(cx=7.0, cy=4.8)),
        ('icsp', dict(cx=64.97, cy=25.24)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('ecap', dict(cx=16.4, cy=33.4, r=2.6)), ('ecap', dict(cx=16.4, cy=40.2, r=2.6)),
        ('led', dict(cx=31.6, cy=13.8, color='green')), ('led', dict(cx=31.6, cy=16.6, color='green')), ('led', dict(cx=31.6, cy=19.4, color='red')),
        ('led', dict(cx=58.0, cy=19.4, color='green')),
        ('smd', dict(cx=36.0, cy=14.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=36.0, cy=17.2, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=36.0, cy=20.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=40.0, cy=24.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=44.0, cy=24.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=27.0, cy=30.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=28.6, cy=47.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=47.0, y=30.0, t='UNO R3', size=2.2)),
        ('text', dict(x=24.8, y=13.4, t='L', size=0.9)), ('text', dict(x=24.8, y=16.2, t='TX', size=0.9)), ('text', dict(x=24.8, y=19.0, t='RX', size=0.9)),
    ] + [('hole', dict(cx=x, cy=y, r=1.6)) for (x, y) in UNO_HOLES])

# ---------------- Arduino Mega 2560 ----------------
MOFF = (2.105, 0.075)
BOARDS['mega'] = dict(
    W=96.48, H=50.65, mask='teal', radius=1.0, outline='mega', off=MOFF, LW=98.66, LH=50.8, title='Arduino Mega 2560', pin_silk=False,
    pins=pins_of('mega'),
    comps=[
        ('fheader', strip('mega', ['SCL', 'SDA', 'AREF', 'GND.1', '13', '12', '11', '10', '9', '8'], off=MOFF)),
        ('fheader', strip('mega', ['7', '6', '5', '4', '3', '2', '1', '0'], off=MOFF)),
        ('fheader', strip('mega', ['14', '15', '16', '17', '18', '19', '20', '21'], off=MOFF)),
        ('fheader', strip('mega', ['IOREF', 'RESET', '3.3V', '5V', 'GND.2', 'GND.3', 'VIN'], extra_before=1, off=MOFF)),
        ('fheader', strip('mega', ['A%d' % i for i in range(8)], off=MOFF)),
        ('fheader', strip('mega', ['A%d' % i for i in range(8, 16)], off=MOFF)),
        ('fheader', dict(pts=mod('mega', ['5V.1', '5V.2'] + [str(i) for i in range(22, 54)] + ['GND.4', 'GND.5'], off=MOFF))),
        ('usbb', dict(cx=0, cy=14.0, x0=-6.2, x1=10.0)),
        ('dcjack', dict(cx=2.4, cy=43.0, w=14.4, h=9.0)),
        ('qfp', dict(cx=48.0, cy=24.0, body=14.0, pins=16, rot=0, text='ATMEGA2560')),
        ('qfn', dict(cx=19.0, cy=24.5, s=5, text='16U2', pins=7)),
        ('xtal', dict(cx=27.0, cy=18.0, w=4.8, h=3.6, text='16.000')),
        ('btn2', dict(cx=70.0, cy=22.0)),
        ('icsp', dict(cx=62.0, cy=22.0, cols=2, rows=3)),
        ('sot223', dict(cx=20.0, cy=39.0, rot=0)),
        ('ecap', dict(cx=14.0, cy=32.0, r=2.6)), ('ecap', dict(cx=14.0, cy=38.0, r=2.6)),
        ('led', dict(cx=25.0, cy=13.0, color='green')), ('led', dict(cx=25.0, cy=16.0, color='green')), ('led', dict(cx=25.0, cy=19.0, color='red')),
        ('smd', dict(cx=30.0, cy=13.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=30.0, cy=16.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=29.0, cy=30.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=33.0, cy=36.0, w=1.0, h=0.5, kind='c')),
        ('smd', dict(cx=60.0, cy=30.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=68.0, y=36.0, t='MEGA 2560', size=2.4)),
    ] + [('hole', dict(cx=x, cy=y, r=1.6)) for (x, y) in [(14.1, 2.41), (62.7, 16.9)]])

# ---------------- Arduino Leonardo ----------------
LEO_L = ['D13 PWM', 'D12/A11', 'D11 PWM', 'D10 PWM/A10', 'D9 PWM/A9', 'D8/A8']
BOARDS['leonardo'] = dict(
    W=70.38, H=53.34, mask='teal', radius=1.0, outline='uno', title='Arduino Leonardo', pin_silk=False,
    pins=pins_of('leonardo')
    + [dict(name='icsp%d' % i, x=x, y=y, silk='', side='b') for i, (x, y) in enumerate([(63.7, 22.7), (63.7, 25.24), (63.7, 27.78), (66.24, 22.7), (66.24, 25.24), (66.24, 27.78)])],
    comps=[
        ('fheader', strip('leonardo', ['SCL', 'SDA', 'AREF', 'GND.104', 'D13 PWM', 'D12/A11', 'D11 PWM', 'D10 PWM/A10', 'D9 PWM/A9', 'D8/A8'])),
        ('fheader', strip('leonardo', ['D7', 'D6 PWM/A7', 'D5 PWM', 'D4/A6', 'D3 PWM/SCL', 'D2/SDA', 'D1/TX', 'D0/RX'])),
        ('fheader', strip('leonardo', ['n.c.', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND.90', 'VIN'])),
        ('fheader', strip('leonardo', ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'])),
        ('micro', dict(cx=0, edge=-0.6, side='l', cy=15.3)),
        ('dcjack', dict(cx=3.2, cy=46.2, w=14.4, h=9.0)),
        ('qfp', dict(cx=50.0, cy=34.5, body=10.0, pins=11, rot=0, text='ATMEGA32U4')),
        ('xtal', dict(cx=51.8, cy=24.4, w=4.8, h=3.6, text='16.000')),
        ('btn2', dict(cx=6.4, cy=5.0)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('ecap', dict(cx=16.4, cy=33.4, r=2.6)), ('ecap', dict(cx=16.4, cy=40.2, r=2.6)),
        ('led', dict(cx=10.0, cy=28.0, color='green')), ('led', dict(cx=10.0, cy=31.0, color='green')), ('led', dict(cx=10.0, cy=34.0, color='red')), ('led', dict(cx=10.0, cy=37.0, color='green')),
        ('smd', dict(cx=16.0, cy=28.0, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=16.0, cy=31.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=38.0, cy=24.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=44.0, cy=45.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=30.0, y=21.0, t='LEONARDO', size=2.0)),
    ] + [('hole', dict(cx=x, cy=y, r=1.6)) for (x, y) in UNO_HOLES])
# разъём ICSP на Leonardo: гребёнка 2 x 3
BOARDS['leonardo']['comps'].append(('icsp', dict(cx=64.97, cy=25.24)))

# ---------------- Arduino Nano ----------------
NANO_T = ['12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'GND.2', 'RESET.2', '0', '1']
BOARDS['nano'] = dict(
    W=43.18, H=17.78, mask='teal', radius=1.0, title='Arduino Nano', pin_silk=False,
    pins=pins_of('nano'),
    comps=[
        ('micro', dict(cx=0, edge=-1.4, side='l', cy=8.9)),
        ('qfp', dict(cx=21.0, cy=8.9, body=7.0, pins=8, rot=45, text='ATMEGA328P')),
        ('xtal', dict(cx=11.2, cy=8.9, w=3.6, h=2.2, text='16M')),
        ('qfn', dict(cx=15.0, cy=4.6, s=3.4, text='', pins=4)),
        ('btn', dict(cx=29.8, cy=8.9, small=True)),
        ('icsp', dict(cx=37.0, cy=8.9, cols=3, rows=2)),
        ('led', dict(cx=31.6, cy=12.8, color='red')), ('led', dict(cx=33.8, cy=12.8, color='green')), ('led', dict(cx=29.2, cy=12.8, color='green')),
        ('sot223', dict(cx=12.0, cy=13.2, rot=0, small=True)),
        ('smd', dict(cx=19.0, cy=14.4, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=24.0, cy=14.4, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=8.6, cy=5.0, w=1.0, h=0.5, kind='c')),
        ('text', dict(x=22.0, y=3.6, t='NANO', size=1.2)),
    ])

# ---------------- Arduino Pro Mini (SparkFun-формат, 33 x 18) ----------------
BOARDS['promini'] = dict(
    W=17.78, H=33.02, mask='red', radius=0.8, title='Arduino Pro Mini', pin_silk=False,
    pins=pins_of('promini'),
    comps=[
        ('qfp', dict(cx=8.9, cy=19.0, body=6.0, pins=8, rot=45, text='ATMEGA\n328P')),
        ('sot223', dict(cx=8.9, cy=7.0, rot=0, small=True)),
        ('ceramic_ant', dict(cx=4.6, cy=24.2, w=3.2, h=1.4)),
        ('btn', dict(cx=11.0, cy=28.8, small=True)),
        ('led', dict(cx=5.0, cy=11.4, color='red', rot=90)), ('led', dict(cx=12.4, cy=11.0, color='green', rot=90)),
        ('smd', dict(cx=5.5, cy=19.5, w=1.0, h=0.5, kind='c', rot=90)), ('smd', dict(cx=12.6, cy=22.0, w=1.0, h=0.5, kind='r', rot=90)),
        ('smd', dict(cx=5.5, cy=28.5, w=1.0, h=0.5, kind='r')),
    ])

# ---------------- Raspberry Pi Pico / Pico W / Pico 2 (21 x 51 + 2 мм USB) ----------------
PICO_YS = [3.366 - 2 + i * 2.54 for i in range(20)]


def pico(art, title, chip, extra):
    return dict(
        W=21.0, H=51.0, mask='green', radius=1.0, off=(0.0, 2.0), LW=21.0, LH=53.0, title=title, pin_silk=False,
        pins=pins_of(art),
        comps=[
            ('micro', dict(cx=10.5, edge=-1.6, side='t')),
            ('castell', dict(ys=PICO_YS, W=21.0)),
            ('qfn', dict(cx=10.5, cy=21.4, s=7, text=chip, pins=12)),
            ('soic', dict(cx=15.2, cy=28.6, w=4.0, h=3.0, text='W25Q', pins=8)),
            ('xtal', dict(cx=16.6, cy=18.6, w=3.2, h=2.5, text='12M')),
            ('btn2', dict(cx=5.0, cy=14.6, top='btn_white', size=3.6)),
            ('led', dict(cx=15.8, cy=9.6, color='green')),
            ('smd', dict(cx=6.4, cy=22.0, w=1.0, h=0.5, kind='c', rot=90)), ('smd', dict(cx=6.4, cy=25.0, w=1.0, h=0.5, kind='c', rot=90)),
            ('smd', dict(cx=14.4, cy=23.4, w=1.0, h=0.5, kind='r')), ('smd', dict(cx=9.0, cy=29.6, w=1.0, h=0.5, kind='c')),
            ('smd', dict(cx=12.0, cy=14.4, w=1.0, h=0.5, kind='r')),
            ('pad3', dict()),
        ] + extra + [('hole', dict(cx=x, cy=y, r=1.05)) for (x, y) in [(4.8, 2.0), (16.2, 2.0), (4.8, 49.0), (16.2, 49.0)]])


def _pico_pad3(spec):
    spec['comps'] = [c for c in spec['comps'] if c[0] != 'pad3']
    return spec


BOARDS['pico'] = _pico_pad3(pico('pico', 'Raspberry Pi Pico', 'RP2040', [
    ('text', dict(x=10.5, y=34.6, t='Pico', size=1.6)), ('text', dict(x=10.5, y=37.4, t='RP2040', size=0.8)),
]))
BOARDS['picow'] = _pico_pad3(pico('picow', 'Raspberry Pi Pico W', 'RP2040', [
    ('shieldbox', dict(cx=11.0, cy=40.2, w=11.6, h=10.4, text='CYW43439')),
    ('antenna', dict(cx=7.2, cy=47.6, w=8.0, h=2.4, n=4)),
    ('text', dict(x=10.5, y=34.6, t='Pico W', size=1.2)),
]))
BOARDS['pico2'] = _pico_pad3(pico('pico2', 'Raspberry Pi Pico 2', 'RP2350', [
    ('text', dict(x=10.5, y=34.6, t='Pico 2', size=1.4)), ('text', dict(x=10.5, y=37.4, t='RP2350', size=0.8)),
]))

# ---------------- STM32 Nucleo-64 (NUCLEO-F401RE): схема в масштабе 1.7, модель — настоящие размеры ----------------
NK = 1.7
BOARDS['nucleo64'] = dict(
    W=83.65, H=69.94, mask='white', radius=1.5, k=NK, title='NUCLEO-F401RE', pin_silk=False,
    pins=pins_of('nucleo64'),
    comps=[
        ('fheader', strip('nucleo64', ['D15', 'D14', 'AREF', 'GND.a', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'], k=NK)),
        ('fheader', strip('nucleo64', ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'], k=NK)),
        ('fheader', strip('nucleo64', ['NC.a', 'IOREF', 'RESET', '3V3', '5V', 'GND.b', 'GND.c', 'VIN'], k=NK)),
        ('fheader', strip('nucleo64', ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], k=NK)),
        ('micro', dict(cx=0, edge=-1.6, side='l', cy=23.7)),
        ('qfp', dict(cx=16.7, cy=34.4, body=7.0, pins=12, rot=0, text='ST-LINK')),
        ('qfp', dict(cx=59.3, cy=35.8, body=10.0, pins=16, rot=0, text='STM32\nF401RET6')),
        ('xtal', dict(cx=17.6, cy=43.9, w=9.0, h=3.6, text='8.000')),
        ('xtal_sm', dict(cx=40.6, cy=30.4)),
        ('btn2', dict(cx=30.4, cy=45.3, top='btn_blue')), ('btn2', dict(cx=30.4, cy=26.8, top='btn_top')),
        ('sot223', dict(cx=38.6, cy=40.3, rot=0)),
        ('led', dict(cx=24.6, cy=20.4, color='green')), ('led', dict(cx=24.6, cy=22.8, color='red')),
        ('pinheader', dict(cx=23.4, cy=51.4, n=2, vertical=True)),
        ('smd', dict(cx=40.0, cy=22.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=46.0, cy=48.0, w=1.0, h=0.5, kind='r')),
        ('smd', dict(cx=26.0, cy=36.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=8.4, cy=44.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=45.0, y=22.0, t='NUCLEO-F401RE', size=1.6, c='blue')), ('text', dict(x=30.4, y=50.0, t='USER', size=0.9)),
        ('text', dict(x=30.4, y=22.5, t='RESET', size=0.9)),
    ] + [('hole', dict(cx=x, cy=y, r=1.6)) for (x, y) in [(30.0, 11.5), (30.0, 57.5), (81.6, 21.8), (81.0, 56.0)]])
