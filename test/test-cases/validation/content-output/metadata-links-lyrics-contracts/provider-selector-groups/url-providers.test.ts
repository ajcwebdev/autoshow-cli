import {
  SCRAPECREATORS_ALL_LINKS,
  SCRAPECREATORS_GENERAL_LINKS,
  SCRAPECREATORS_STT_LINKS,
  SPIDER_ALL_LINKS,
  SPIDER_GENERAL_LINKS,
  SPIDER_URL_LINKS,
  X_ALL_LINKS,
  X_GENERAL_LINKS,
  X_URL_LINKS,
  ZYTE_ALL_LINKS,
  ZYTE_GENERAL_LINKS,
  ZYTE_URL_LINKS
} from './fixtures/index'
import { registerProviderSelectorCases } from './provider-selector-cases'

registerProviderSelectorCases([
  {
    name: 'links selector accepts x provider with general and url sections',
    provider: 'x',
    all: { expected: X_ALL_LINKS },
    selections: [
      { sections: ['general'], expected: X_GENERAL_LINKS },
      { sections: ['url'], expected: X_URL_LINKS }
    ]
  },
  {
    name: 'links selector accepts scrapecreators provider with general and stt sections',
    provider: 'scrapecreators',
    all: { expected: SCRAPECREATORS_ALL_LINKS },
    selections: [
      { sections: ['general'], expected: SCRAPECREATORS_GENERAL_LINKS },
      { sections: ['stt'], expected: SCRAPECREATORS_STT_LINKS }
    ],
    invalid: { sections: ['url'], message: 'Unknown links section(s) for --provider scrapecreators: url' }
  },
  {
    name: 'links selector accepts zyte provider with general and url sections',
    provider: 'zyte',
    all: { expected: ZYTE_ALL_LINKS },
    selections: [
      { sections: ['general'], expected: ZYTE_GENERAL_LINKS },
      { sections: ['url'], expected: ZYTE_URL_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --provider zyte: tts' }
  },
  {
    name: 'links selector accepts spider provider with general and url sections',
    provider: 'spider',
    all: { expected: SPIDER_ALL_LINKS },
    selections: [
      { sections: ['general'], expected: SPIDER_GENERAL_LINKS },
      { sections: ['url'], expected: SPIDER_URL_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --provider spider: tts' }
  }
])
