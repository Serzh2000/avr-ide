# Платы пятой волны: Nucleo-64 других кристаллов (F411RE, F446RE, F103RB, L053R8, L476RG, G474RE) и Nucleo-32 G431KB.
# Модель и разъёмы те же, что у NUCLEO-F401RE / NUCLEO-L432KC (одинаковые Arduino- и Morpho-разъёмы), меняются надписи кристалла и платы.
import copy
import boards2
import boards

BOARDS = {}


def _retext(spec, title, chip, repl):
    s = copy.deepcopy(spec)
    s['title'] = title
    out = []
    for kind, d in s['comps']:
        d = dict(d)
        if kind == 'text' and d.get('t') in repl:
            d['t'] = repl[d['t']]
        if kind in ('qfp', 'qfn') and d.get('text', '').startswith('STM32') and 'ST-LINK' not in d['text']:
            d['text'] = chip
        out.append((kind, d))
    s['comps'] = out
    return s


for key, name, chip in (('f411re', 'F411RE', 'STM32' + chr(10) + 'F411RET6'), ('f446re', 'F446RE', 'STM32' + chr(10) + 'F446RET6'),
                        ('f103rb', 'F103RB', 'STM32' + chr(10) + 'F103RBT6'), ('l053r8', 'L053R8', 'STM32' + chr(10) + 'L053R8T6'),
                        ('l476rg', 'L476RG', 'STM32' + chr(10) + 'L476RGT6'), ('g474re', 'G474RE', 'STM32' + chr(10) + 'G474RET6')):
    BOARDS['nucleo64-' + key] = _retext(boards2.BOARDS['nucleo64'], 'NUCLEO-' + name, chip, {'NUCLEO-F401RE': 'NUCLEO-' + name})
BOARDS['nucleo32-g431kb'] = _retext(boards.BOARDS['nucleo32'], 'NUCLEO-G431KB', 'STM32' + chr(10) + 'G431KB', {'L432KC': 'G431KB'})
