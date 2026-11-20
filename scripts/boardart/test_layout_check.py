# Самопроверка порогов layout_check.py на синтетических деталях (без Blender): python -I scripts/boardart/test_layout_check.py
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout_check as L  # noqa: E402

assert (L.GAP, L.GAP_SMD, L.GAP_TEXT_PART, L.GAP_TEXT, L.GAP_RING, L.EDGE) == (1.0, 0.5, 0.5, 0.4, 0.5, 0.3), 'пороги ослаблены'
assert set(L.OVERHANG) == {'usbc', 'micro', 'usbb', 'dcjack', 'module', 'castell', 'antenna', 'hole'}, 'список выступов за контур изменён'
assert L.COVER_KINDS == ('fheader', 'pinheader', 'icsp', 'dip'), 'площадка под корпусом — только под гребёнкой/разъёмом'


def run(kinds, gap, w=2.0, h=2.0):
    """Две детали w x h с зазором gap по оси X, далеко от краёв; возвращает коды замечаний."""
    ents = []
    for i, k in enumerate(kinds):
        text = k in L.TEXTS
        e = L.Entity(i, k, k + str(i))
        x = 40 + i * (w + gap)
        e.parts.append(L.Part(i, L.box_poly(x, 40, w, h, 0), 'plastic_black', False, 't' if text else ''))
        ents.append(e)
    return [i[0] for i in L.check(ents, 100, 100)], L.min_gap(ents)


def bad(kinds, gap):
    return run(kinds, gap)[0] == ['overlap']


def ok(kinds, gap):
    return run(kinds, gap)[0] == []


assert bad(('sot223', 'ecap'), 0.9) and ok(('sot223', 'ecap'), 1.05), 'деталь-деталь: 1.0 мм'
assert bad(('smd', 'smd'), 0.4) and ok(('smd', 'smd'), 0.6), 'мелкие SMD: 0.5 мм'
assert bad(('smd', 'led'), 0.4) and ok(('led', 'smd'), 0.6), 'мелкие SMD и светодиоды: 0.5 мм'
assert bad(('smd', 'sot223'), 0.9) and ok(('smd', 'sot223'), 1.05), 'SMD-деталь: 1.0 мм'
assert bad(('text', 'text'), 0.3) and ok(('text', 'text'), 0.5), 'надпись-надпись: 0.4 мм'
assert bad(('text', 'btn'), 0.4) and ok(('text', 'btn'), 0.6), 'деталь-надпись: 0.5 мм'
assert bad(('pinsilk', 'ecap'), 0.4) and ok(('pinsilk', 'ecap'), 0.6), 'подпись вывода — тоже надпись'
assert bad(('hole', 'btn'), 0.4) and ok(('hole', 'btn'), 0.6), 'кольцо отверстия: 0.5 мм'
assert bad(('pad', 'btn'), 0.4) and ok(('pad', 'btn'), 0.6), 'контактная площадка: 0.5 мм'
assert run(('ecap', 'sot223'), 0.7)[1][0] < 0.75 and abs(run(('ecap', 'sot223'), 0.7)[1][3] - 1.0) < 1e-9, 'отчёт о минимальном зазоре'


def edge(kind, x, y=50.0):
    e = L.Entity(0, kind, kind)
    e.parts.append(L.Part(0, L.box_poly(x, y, 2.0, 2.0, 0), 'plastic_black'))
    return [i[0] for i in L.check([e], 100, 100)]


assert edge('btn', 1.1) == ['outside'] and edge('btn', 1.4) == [], 'отступ от контура 0.3 мм'
assert edge('qfn', -0.5) == ['outside'], 'микросхема не выходит за контур'
assert edge('usbc', 1.0, 0.0) == [] and edge('dcjack', -0.5) == [], 'USB и DC-гнездо могут выступать'
assert edge('icsp', 1.0) == [] and edge('icsp', 0.9) == ['outside'], 'ICSP — вровень с краем, не за ним'
print('layout_check: ok')
