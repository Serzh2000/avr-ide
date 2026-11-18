# Платы пятой волны: Adafruit QT Py ESP32-S3 / S2 / C3, Feather M4 Express, ItsyBitsy M4 Express.
# Единицы — мм, начало — левый верхний угол платы, ось y вниз. Порядок выводов — по официальным схемам Adafruit (PDF в репозиториях *-PCB);
# габариты по форм-фактору (QT Py — как XIAO, Feather 50.8 x 22.86, ItsyBitsy 36 x 18), мелочь приблизительна.
from boards import col
import boards4
import boards6

BOARDS = {}

# ---------------- QT Py ESP32-S3 / S2 / C3 (форм-фактор QT Py, 21 x 17.8) ----------------
_qt = boards6.BOARDS['qtpy-rp2040']


def _qtpy(title, chip, left):
    return dict(
        _qt, title=title,
        pins=col('L', 1.0, 3.0, left, 'r') + col('R', 16.8, 3.0, ['5V', 'GND', '3V3', 'MOSI', 'MISO', 'SCK', 'RX'], 'l'),
        comps=[
            ('usbc', dict(cx=8.9, edge=-0.9, side='t')),
            ('shieldbox', dict(cx=11.2, cy=12.6, w=7.0, h=7.4, text=chip)),
            ('btn', dict(cx=4.6, cy=9.8, small=True)), ('btn', dict(cx=4.6, cy=14.8, small=True)),
            ('smd', dict(cx=11.0, cy=18.6, w=1.0, h=0.5, kind='r')),
        ])


QTL = ['A0', 'A1', 'A2', 'A3', 'SDA', 'SCL', 'TX']
BOARDS['qtpy-esp32s3'] = _qtpy('QT Py ESP32-S3', 'ESP32-S3', QTL)
BOARDS['qtpy-esp32s2'] = _qtpy('QT Py ESP32-S2', 'ESP32-S2', QTL)
BOARDS['qtpy-esp32c3'] = _qtpy('QT Py ESP32-C3', 'ESP32-C3', QTL)

# ---------------- Feather M4 Express ----------------
FM4L = ['RESET', '3V3', 'AREF', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'D0', 'D1', 'D4']
FM4R = ['VBAT', 'EN', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D6', 'D5', 'SCL', 'SDA']
_fm0 = boards4.BOARDS['feather-m0-express']
BOARDS['feather-m4-express'] = dict(
    _fm0, title='Feather M4 Express',
    pins=boards4.feather_pins(FM4L, FM4R),
    comps=[
        ('micro', dict(cx=11.43, edge=-1.2, side='t')),
        ('btn', dict(cx=4.6, cy=12.2, small=True)),
        ('smd', dict(cx=16.6, cy=11.6, w=6.4, h=4.4, kind='c')),
        ('led', dict(cx=16.4, cy=17.6, color='red')), ('rgb', dict(cx=18.4, cy=27.0)),
        ('qfp', dict(cx=11.43, cy=30.0, body=7.0, pins=16, rot=0, text='SAMD51')),
        ('soic', dict(cx=11.43, cy=40.0, w=3.4, h=2.8, text='', pins=8)),
        ('xtal_sm', dict(cx=16.6, cy=35.0)),
        ('sot223', dict(cx=11.43, cy=21.4, rot=0, small=True)),
        ('smd', dict(cx=5.6, cy=36.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=17.2, cy=40.6, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=11.43, y=46.4, t='FEATHER M4 EXPRESS', size=0.55)),
    ])

# ---------------- ItsyBitsy M4 Express ----------------
IM4L = ['RESET', '3V3', 'AREF', 'VHI', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MOSI', 'MISO', 'D2']
IM4R = ['VBAT', 'GND', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D7', 'D5', 'SCL', 'SDA', 'D1', 'D0']
_im0 = boards6  # noqa: F841
import boards8  # noqa: E402

_it = boards8.BOARDS['itsybitsy-m0-express']
BOARDS['itsybitsy-m4-express'] = dict(
    _it, title='ItsyBitsy M4 Express',
    pins=col('L', 2.65, 1.6, IM4L, 'r') + col('R', 15.35, 1.6, IM4R, 'l'),
    comps=[
        ('micro', dict(cx=9.0, edge=-1.2, side='t')),
        ('qfp', dict(cx=9.0, cy=19.0, body=7.0, pins=16, rot=0, text='SAMD51')),
        ('soic', dict(cx=9.0, cy=27.0, w=3.2, h=2.6, text='', pins=8)),
        ('btn', dict(cx=6.4, cy=30.8, small=True)), ('btn', dict(cx=11.6, cy=30.8, small=True)),
        ('rgb', dict(cx=9.0, cy=10.4)),
        ('smd', dict(cx=5.0, cy=22.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=13.0, cy=14.0, w=1.0, h=0.5, kind='r')),
        ('text', dict(x=9.0, y=33.6, t='ITSYBITSY M4', size=0.55)),
    ])
