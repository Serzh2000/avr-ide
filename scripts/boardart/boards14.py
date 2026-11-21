# Платы пятой волны (продолжение): Adafruit Metro M4 Express (формат Uno; разъёмы те же, что у Uno).
import boards2

BOARDS = {}
_uno = boards2.BOARDS['uno']
_hdr = [c for c in _uno['comps'] if c[0] in ('fheader', 'hole')]
BOARDS['metro-m4-express'] = dict(
    _uno, title='Metro M4 Express',
    comps=_hdr + [
        ('micro', dict(cx=0, edge=-1.4, side='l', cy=15.3)),
        ('dcjack', dict(cx=3.2, cy=46.2, w=14.4, h=9.0)),
        ('qfp', dict(cx=40.0, cy=30.0, body=10.0, pins=16, rot=0, text='SAMD51')),
        ('btn2', dict(cx=7.0, cy=4.8)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('ecap', dict(cx=16.4, cy=33.4, r=2.6)),
        ('rgb', dict(cx=24.0, cy=17.0)),
        ('led', dict(cx=33.0, cy=13.8, color='green')), ('led', dict(cx=33.0, cy=16.6, color='green')), ('led', dict(cx=33.0, cy=19.4, color='red')),
        ('smd', dict(cx=46.0, cy=42.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=28.6, cy=47.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=47.0, y=45.0, t='METRO M4', size=1.8)),
    ])

# Adafruit Metro M0 Express (SAMD21, формат Uno)
BOARDS['metro-m0-express'] = dict(
    _uno, title='Metro M0 Express',
    comps=_hdr + [
        ('micro', dict(cx=0, edge=-1.4, side='l', cy=15.3)),
        ('dcjack', dict(cx=3.2, cy=46.2, w=14.4, h=9.0)),
        ('qfp', dict(cx=40.0, cy=30.0, body=7.0, pins=12, rot=0, text='SAMD21')),
        ('btn2', dict(cx=7.0, cy=4.8)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('ecap', dict(cx=16.4, cy=33.4, r=2.6)),
        ('soic', dict(cx=24.0, cy=17.0, w=4.0, h=3.0, text='', pins=8)),
        ('led', dict(cx=33.0, cy=13.8, color='green')), ('led', dict(cx=33.0, cy=16.6, color='green')), ('led', dict(cx=33.0, cy=19.4, color='red')),
        ('smd', dict(cx=46.0, cy=42.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=28.6, cy=47.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=47.0, y=45.0, t='METRO M0', size=1.8)),
    ])

# Adafruit Metro ESP32-S3 (габариты 68.58 x 53.34 мм — по файлу платы Adafruit; положение деталей приблизительное)
BOARDS['metro-esp32-s3'] = dict(
    _uno, title='Metro ESP32-S3',
    comps=_hdr + [
        ('usbc', dict(cx=0, edge=-0.9, side='l', cy=15.3)),
        ('dcjack', dict(cx=3.2, cy=46.2, w=14.4, h=9.0)),
        ('shieldbox', dict(cx=26.0, cy=14.0, w=16.0, h=13.0, text='ESP32-S3')),
        ('btn2', dict(cx=7.0, cy=4.8)),
        ('sot223', dict(cx=22.4, cy=41.4, rot=0)),
        ('ecap', dict(cx=16.4, cy=33.4, r=2.6)),
        ('led', dict(cx=46.0, cy=22.0, color='green')), ('led', dict(cx=46.0, cy=24.8, color='red')),
        ('smd', dict(cx=46.0, cy=42.0, w=1.0, h=0.5, kind='c')), ('smd', dict(cx=28.6, cy=47.0, w=2.0, h=1.2, kind='c')),
        ('text', dict(x=47.0, y=45.0, t='METRO ESP32-S3', size=1.6)),
    ])
