# Проверка размещения деталей и надписей на плате (в плоскости платы, мм): пересечения «деталь↔деталь», «деталь↔надпись»,
# «надпись↔надпись», «деталь/надпись↔контактная площадка вывода», «что угодно↔вне контура платы».
# Модуль без bpy: render.py регистрирует реальные габариты (OBB) всех добавленных боксов, цилиндров и надписей (надписи — по bounding box
# текстового объекта Blender), а здесь выполняются проверка и автоматическая раскладка декоративных деталей (layout_fixes.json).
import math

# ПОРОГИ (ужесточены): минимальный зазор между габаритами (корпус + выводы/площадки/ножки — всё, что рисуется), мм
GAP = 1.0          # деталь <-> деталь (кроме пары мелких SMD)
GAP_SMD = 0.5      # между мелкими SMD (резисторы, конденсаторы 0402-0805, светодиоды)
GAP_TEXT_PART = 0.5  # деталь <-> надпись (в том числе подпись вывода)
GAP_TEXT = 0.4     # надпись <-> надпись
GAP_RING = 0.5     # кольцо монтажного отверстия и контактная площадка вывода <-> всё остальное
GAP_FIXED = 0.5    # две «жёсткие» детали (разъёмы, гребёнки, модули: положение задано документацией)
EPS = 0.005        # допуск округления, мм
EDGE = 0.3         # минимальный отступ детали от контура платы (кроме разрешённых выступов)
TINY = ('smd', 'led')
TEXTS = ('text', 'pinsilk')
RINGS = ('hole', 'pad')
# жёсткие детали: их положение задано чертежом/документацией (автораскладка их не двигает)
FIXED = ('usbc', 'micro', 'usbb', 'dcjack', 'module', 'castell', 'antenna', 'fheader', 'pinheader', 'icsp', 'dip', 'hole', 'pad')
# разрешённые выступы за контур платы: только USB, DC-гнездо, модули (с антенной), полуотверстия, монтажные отверстия по краю
OVERHANG = ('usbc', 'micro', 'usbb', 'dcjack', 'module', 'castell', 'antenna', 'hole')
FLUSH = ('icsp', 'pinheader', 'fheader')  # вровень с краем (не выходя за него)
BODY_MATS = ('plastic_black', 'plastic_gray', 'plastic_white', 'shield', 'socket', 'usb', 'module_pcb', 'ceramic', 'btn_top', 'tin')
# детали, которые автоматическая раскладка может сдвигать (декоративные; расположение ключевых деталей — по документации, их правят вручную)
MOVABLE_FIRST = ('text', 'smd', 'led')
MOVABLE_MORE = ('rgb', 'ecap', 'sot223', 'xtal_sm', 'xtal', 'soic', 'jumper')
MOVABLE_LAST = ('btn', 'btn2', 'qfn', 'qfp', 'shieldbox', 'bga', 'box', 'lens', 'ceramic_ant')
DROP_ORDER = ('smd', 'led', 'jumper', 'xtal_sm', 'soic')  # порядок отбрасывания при нехватке места
# ЯВНЫЕ ИСКЛЮЧЕНИЯ (не считаются наложением):
#  - полуотверстия Pico (castell) и площадки выводов — это одни и те же контакты;
#  - площадка вывода под корпусом гребёнки/разъёма (не видна: пластик сидит на площадке).
EXC_KINDS = {('castell', 'pad')}
COVER_KINDS = ('fheader', 'pinheader', 'icsp', 'dip')  # только настоящие гребёнки/разъёмы


def box_poly(cx, cy, w, h, rot):
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    out = []
    for lx, ly in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        out.append((cx + lx * c - ly * s, cy + lx * s + ly * c))
    return out


def circ_poly(cx, cy, r, n=16):
    rr = r / math.cos(math.pi / n)
    return [(cx + rr * math.cos(2 * math.pi * i / n), cy + rr * math.sin(2 * math.pi * i / n)) for i in range(n)]


def aabb(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return (min(xs), min(ys), max(xs), max(ys))


def _axes(poly):
    ax = []
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        ex, ey = x1 - x0, y1 - y0
        l = math.hypot(ex, ey) or 1.0
        ax.append((-ey / l, ex / l))
    return ax


def _overlap(a, b):
    for ax in _axes(a) + _axes(b):
        pa = [p[0] * ax[0] + p[1] * ax[1] for p in a]
        pb = [p[0] * ax[0] + p[1] * ax[1] for p in b]
        if max(pa) < min(pb) or max(pb) < min(pa):
            return False
    return True


def _seg_dist(p, a, b):
    ax, ay = b[0] - a[0], b[1] - a[1]
    l2 = ax * ax + ay * ay
    t = 0 if l2 == 0 else max(0, min(1, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / l2))
    return math.hypot(p[0] - a[0] - t * ax, p[1] - a[1] - t * ay)


def poly_dist(a, b):
    """Расстояние между выпуклыми многоугольниками (0 при пересечении)."""
    if _overlap(a, b):
        return 0.0
    d = 1e9
    for P, Q in ((a, b), (b, a)):
        for p in P:
            for i in range(len(Q)):
                d = min(d, _seg_dist(p, Q[i], Q[(i + 1) % len(Q)]))
    return d


class Part:
    __slots__ = ('ent', 'poly', 'bb', 'mat', 'is_text', 'label')

    def __init__(self, ent, poly, mat='', is_text=False, label=''):
        self.ent, self.poly, self.mat, self.is_text, self.label = ent, poly, mat, is_text, label
        self.bb = aabb(poly)

    def shifted(self, dx, dy):
        return Part(self.ent, [(x + dx, y + dy) for x, y in self.poly], self.mat, self.is_text, self.label)


class Entity:
    def __init__(self, eid, kind, label):
        self.eid, self.kind, self.label = eid, kind, label
        self.parts = []
        self.skip_pad = False


def gap_for(ka, kb):
    if ka in TEXTS and kb in TEXTS:
        return GAP_TEXT
    if ka in TEXTS or kb in TEXTS:
        return GAP_TEXT_PART
    if ka in TINY and kb in TINY:
        return GAP_SMD
    if ka in RINGS or kb in RINGS:
        return GAP_RING
    if ka in FIXED and kb in FIXED:
        return GAP_FIXED
    return GAP


def _near(a, b, g):
    return not (a[2] + g < b[0] or b[2] + g < a[0] or a[3] + g < b[1] or b[3] + g < a[1])


def entity_dist(ea, eb, g, partsa=None, partsb=None):
    """Минимальное расстояние между сущностями; None, если дальше g."""
    best = None
    for pa in (partsa or ea.parts):
        for pb in (partsb or eb.parts):
            if not _near(pa.bb, pb.bb, g):
                continue
            d = poly_dist(pa.poly, pb.poly)
            if d < g - EPS and (best is None or d < best):
                best = d
    return best


def kind_of(e):
    return e.kind


def check(ents, W, H):
    """Список замечаний [(код, A, B, x, y, текст)]. A, B — подписи сущностей."""
    out = []
    n = len(ents)
    for i in range(n):
        a = ents[i]
        # вне контура
        if a.kind != 'pad':
            lim = 0.0 if (a.kind in FLUSH or a.kind in OVERHANG) else EDGE
            for p in a.parts:
                if a.kind in OVERHANG:
                    cx, cy = (p.bb[0] + p.bb[2]) / 2, (p.bb[1] + p.bb[3]) / 2
                    if a.kind == 'hole' and not (0 <= cx <= W and 0 <= cy <= H):
                        out.append(('outside', a.label, '', cx, cy, f'{a.label} центром за контуром платы'))
                        break
                    continue
                if p.bb[0] < lim - 0.01 or p.bb[1] < lim - 0.01 or p.bb[2] > W - lim + 0.01 or p.bb[3] > H - lim + 0.01:
                    out.append(('outside', a.label, '', (p.bb[0] + p.bb[2]) / 2, (p.bb[1] + p.bb[3]) / 2, f'{a.label} ближе {lim} мм к контуру платы или за ним'))
                    break
        # надпись внутри собственной детали
        if a.kind not in ('text', 'pinsilk', 'pad'):
            bodies = [p for p in a.parts if not p.is_text and p.mat in BODY_MATS]
            for t in (p for p in a.parts if p.is_text):
                ok = any(all(_inside(q, b.poly, 0.05) for q in t.poly) for b in bodies)
                if not ok:
                    out.append(('label', a.label, t.label, t.bb[0], t.bb[1], f'надпись «{t.label}» выходит за корпус {a.label}'))
        for j in range(i + 1, n):
            b = ents[j]
            if a.kind == 'pad' and b.kind == 'pad':
                continue
            if (a.kind, b.kind) in EXC_KINDS or (b.kind, a.kind) in EXC_KINDS:
                continue
            if _covered(a, b) or _covered(b, a):
                continue
            g = gap_for(a.kind, b.kind)
            d = entity_dist(a, b, g)
            if d is not None:
                x = max(a.parts[0].bb[0], b.parts[0].bb[0])
                out.append(('overlap', a.label, b.label, x, max(a.parts[0].bb[1], b.parts[0].bb[1]), f'{a.label} <-> {b.label}: зазор {d:.2f} мм < {g}'))
    return out


def min_gap(ents, limit=6.0):
    """Минимальный зазор по плате среди всех проверяемых пар: (мм, подпись A, подпись B, требуемый зазор)."""
    best = (limit, '', '', 0)
    for i in range(len(ents)):
        a = ents[i]
        for j in range(i + 1, len(ents)):
            b = ents[j]
            if a.kind == 'pad' and b.kind == 'pad':
                continue
            if (a.kind, b.kind) in EXC_KINDS or (b.kind, a.kind) in EXC_KINDS or _covered(a, b) or _covered(b, a):
                continue
            d = entity_dist(a, b, best[0])
            if d is not None and d < best[0]:
                best = (d, a.label, b.label, gap_for(a.kind, b.kind))
    return best


def _covered(pad, cover):
    if pad.kind != 'pad' or cover.kind not in COVER_KINDS:
        return False
    px = sum(p[0] for p in pad.parts[0].poly) / len(pad.parts[0].poly)
    py = sum(p[1] for p in pad.parts[0].poly) / len(pad.parts[0].poly)
    return any(c.bb[0] <= px <= c.bb[2] and c.bb[1] <= py <= c.bb[3] for c in cover.parts)


def _inside(pt, poly, slack):
    # точка внутри выпуклого многоугольника (обход по часовой, y вниз), с допуском
    sgn = None
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        cr = (x1 - x0) * (pt[1] - y0) - (y1 - y0) * (pt[0] - x0)
        l = math.hypot(x1 - x0, y1 - y0) or 1
        cr /= l
        if cr < -slack:
            return False
    return True


def _free(parts, others, W, H, ent_kind, g_of):
    for p in parts:
        if p.bb[0] < EDGE or p.bb[1] < EDGE or p.bb[2] > W - EDGE or p.bb[3] > H - EDGE:
            return False
    for o in others:
        for pa in parts:
            for pb in o.parts:
                g = g_of(o)
                if _near(pa.bb, pb.bb, g) and poly_dist(pa.poly, pb.poly) < g - EPS:
                    return False
    return True


def autofix(ents, W, H, log=None):
    """Сдвигает декоративные детали и надписи в ближайшее свободное место. Возвращает {индекс детали: {'d': [dx, dy], 's': масштаб текста, 'drop': 1}}.
    Ключевые детали (чипы, модули, разъёмы, кнопки, гребёнки, пады) не трогаются."""
    fixes = {}
    by_id = {e.eid: e for e in ents}
    for stage in (MOVABLE_FIRST, MOVABLE_FIRST + MOVABLE_MORE, MOVABLE_FIRST + MOVABLE_MORE + MOVABLE_LAST):
        for _ in range(4):
            changed = False
            issues = check(ents, W, H)
            bad = set()
            for code, la, lb, *_ in issues:
                for e in ents:
                    if e.label in (la, lb) and e.kind in stage and isinstance(e.eid, int):
                        bad.add(e.eid)
            if not bad:
                break
            for eid in sorted(bad):
                e = by_id[eid]
                others = [o for o in ents if o is not e and (o.kind, e.kind) not in EXC_KINDS and (e.kind, o.kind) not in EXC_KINDS and not _covered(o, e) and not _covered(e, o)]
                g_of = lambda o, k=e.kind: gap_for(k, o.kind)
                done = False
                scales = (1.0, 0.85, 0.7) if e.kind == 'text' else (1.0,)
                for sc in scales:
                    base = e.parts if sc == 1.0 else [_scale_part(p, sc) for p in e.parts]
                    cands = sorted(((dx * 0.4, dy * 0.4) for dx in range(-40, 41) for dy in range(-40, 41)), key=lambda t: t[0] ** 2 + t[1] ** 2)
                    for dx, dy in cands:
                        moved = [p.shifted(dx, dy) for p in base]
                        if _free(moved, others, W, H, e.kind, g_of):
                            e.parts = moved
                            f = fixes.setdefault(eid, {'d': [0.0, 0.0], 's': 1.0})
                            f['d'][0] += dx
                            f['d'][1] += dy
                            f['s'] *= sc
                            done = changed = True
                            break
                    if done:
                        break
                if not done and e.kind in ('smd', 'text'):
                    e.parts = []
                    fixes[eid] = {'d': [0.0, 0.0], 's': 1.0, 'drop': 1}
                    changed = True
            if not changed:
                break
    # последний шанс: убрать наименее значимые декоративные детали (резисторы/конденсаторы, светодиоды, перемычки, флеш-чипы)
    for _ in range(6):
        issues = check(ents, W, H)
        victim = None
        for code, la, lb, *_ in issues:
            cands = [e for e in ents if e.label in (la, lb) and e.kind in DROP_ORDER and isinstance(e.eid, int) and e.parts]
            for e in cands:
                if victim is None or DROP_ORDER.index(e.kind) < DROP_ORDER.index(victim.kind):
                    victim = e
        if victim is None:
            break
        victim.parts = []
        fixes[victim.eid] = {'d': [0.0, 0.0], 's': 1.0, 'drop': 1}
    return fixes


def _scale_part(p, k):
    cx = sum(x for x, _ in p.poly) / len(p.poly)
    cy = sum(y for _, y in p.poly) / len(p.poly)
    return Part(p.ent, [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in p.poly], p.mat, p.is_text, p.label)
