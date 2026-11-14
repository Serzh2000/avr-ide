// Описание виджетов для data/espui/widgets.json (схема свойств + допустимые привязки).
// Файл генерируется: node --import ./src/renderer/src/uibuilder/tests/register.mjs src/renderer/src/uibuilder/tools/export-schema.ts
import { ESPUI_COLORS, GENERATOR_VERSION, UI_JSON_VERSION } from '../core/types'
import { WIDGETS, WIDGET_ORDER } from '../core/widgets'

export function buildSchema(): string {
  const schema = {
    $comment: 'Сгенерировано из src/renderer/src/uibuilder/core/widgets.ts — не править вручную.',
    uiJsonVersion: UI_JSON_VERSION,
    generatorVersion: GENERATOR_VERSION,
    library: 'https://github.com/s00500/ESPUI',
    colors: ESPUI_COLORS,
    bindingDirections: {
      var: { toUi: 'device→UI: переменная показывается', fromUi: 'UI→device: callback пишет в переменную', both: 'оба направления' },
      pin: { toPin: 'UI→пин: digitalWrite / analogWrite (ESP8266) / ledcWrite (ESP32)', fromPin: 'пин→UI: digitalRead / analogRead' }
    },
    widgets: WIDGET_ORDER.map((t) => {
      const w = WIDGETS[t]
      return {
        type: w.type,
        title: w.title,
        description: w.description,
        espuiControlType: w.espuiType,
        events: w.events,
        defaultLabel: w.defaultLabel,
        defaultProps: w.defaultProps,
        props: w.props.map((p) => ({ key: p.key, kind: p.kind, title: p.title })),
        binding: {
          varToUi: w.varToUi,
          varFromUi: w.varFromUi,
          pinToPin: w.pinToPin,
          pinFromPin: w.pinFromPin
        }
      }
    })
  }
  return JSON.stringify(schema, null, 2) + '\n'
}
