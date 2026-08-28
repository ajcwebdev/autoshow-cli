import {
  FIRECRAWL_GENERAL_LINKS,
  FIRECRAWL_URL_LINKS,
  SCRAPECREATORS_GENERAL_LINKS,
  SCRAPECREATORS_STT_LINKS,
  SCRAPECREATORS_URL_LINKS,
  SPIDER_GENERAL_LINKS,
  SPIDER_URL_LINKS,
  SUPADATA_GENERAL_LINKS,
  SUPADATA_STT_LINKS,
  SUPADATA_URL_LINKS,
  X_GENERAL_LINKS,
  X_URL_LINKS,
  ZYTE_GENERAL_LINKS,
  ZYTE_URL_LINKS
} from './fixtures/index'
import { registerProviderSelectorCases } from './provider-selector-cases'

registerProviderSelectorCases([
  {
    name: 'links selector accepts x provider with general and url sections',
    provider: 'x',
    all: { expected: [...X_GENERAL_LINKS, ...X_URL_LINKS] },
    selections: [
      { sections: ['general'], expected: X_GENERAL_LINKS },
      { sections: ['url'], expected: X_URL_LINKS }
    ]
  },
  {
    name: 'links selector accepts supadata provider with general stt and url sections',
    provider: 'supadata',
    all: { expected: [...SUPADATA_GENERAL_LINKS, ...SUPADATA_STT_LINKS, ...SUPADATA_URL_LINKS] },
    selections: [
      { sections: ['general'], expected: SUPADATA_GENERAL_LINKS },
      { sections: ['stt'], expected: SUPADATA_STT_LINKS },
      { sections: ['url'], expected: SUPADATA_URL_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --supadata: tts' }
  },
  {
    name: 'links selector accepts scrapecreators provider with general stt and url sections',
    provider: 'scrapecreators',
    all: { expected: [...SCRAPECREATORS_GENERAL_LINKS, ...SCRAPECREATORS_STT_LINKS, ...SCRAPECREATORS_URL_LINKS] },
    selections: [
      { sections: ['general'], expected: SCRAPECREATORS_GENERAL_LINKS },
      { sections: ['stt'], expected: SCRAPECREATORS_STT_LINKS },
      { sections: ['url'], expected: SCRAPECREATORS_URL_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --scrapecreators: tts' }
  },
  {
    name: 'links selector accepts zyte provider with general and url sections',
    provider: 'zyte',
    all: { expected: [...ZYTE_GENERAL_LINKS, ...ZYTE_URL_LINKS] },
    selections: [
      { sections: ['general'], expected: ZYTE_GENERAL_LINKS },
      { sections: ['url'], expected: ZYTE_URL_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --zyte: tts' }
  },
  {
    name: 'links selector accepts firecrawl provider with general and url sections',
    provider: 'firecrawl',
    all: { expected: [...FIRECRAWL_GENERAL_LINKS, ...FIRECRAWL_URL_LINKS] },
    selections: [
      { sections: ['general'], expected: FIRECRAWL_GENERAL_LINKS },
      { sections: ['url'], expected: FIRECRAWL_URL_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --firecrawl: tts' }
  },
  {
    name: 'links selector accepts spider provider with general and url sections',
    provider: 'spider',
    all: { expected: [...SPIDER_GENERAL_LINKS, ...SPIDER_URL_LINKS] },
    selections: [
      { sections: ['general'], expected: SPIDER_GENERAL_LINKS },
      { sections: ['url'], expected: SPIDER_URL_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --spider: tts' }
  }
])
