import {
  CARTESIA_ALL_LINKS,
  CARTESIA_GENERAL_LINKS,
  CARTESIA_MODELS_LINKS,
  CARTESIA_TTS_LINKS,
  DEAPI_ALL_LINKS,
  DEAPI_GENERAL_LINKS,
  DEAPI_MODELS_LINKS,
  DEAPI_STT_LINKS,
  GROK_ALL_LINKS,
  GROK_MODELS_LINKS,
  GROK_STT_LINKS,
  GROK_TTS_LINKS,
  HUME_GENERAL_LINKS,
  HUME_TTS_LINKS,
  INWORLD_ALL_LINKS,
  INWORLD_GENERAL_LINKS,
  INWORLD_MODELS_LINKS,
  INWORLD_TTS_LINKS,
  MISTRAL_ALL_LINKS,
  MISTRAL_MODELS_LINKS,
  MISTRAL_OCR_LINKS,
  MISTRAL_STT_LINKS,
  MISTRAL_TTS_LINKS,
  SPEECHIFY_ALL_LINKS,
  SPEECHIFY_MODELS_LINKS,
  SPEECHIFY_TTS_LINKS,
  TOGETHER_ALL_LINKS,
  TOGETHER_GENERAL_LINKS,
  TOGETHER_MODELS_LINKS,
  TOGETHER_TEXT_LINKS
} from './fixtures/index'
import { registerProviderSelectorCases } from './provider-selector-cases'

registerProviderSelectorCases([
  {
    name: 'links selector accepts cartesia provider with general models and tts sections',
    provider: 'cartesia',
    all: { expected: CARTESIA_ALL_LINKS, outputFileName: 'cartesia-all-links.md' },
    selections: [
      { sections: ['tts'], expected: CARTESIA_TTS_LINKS, outputFileName: 'cartesia-tts-links.md' },
      { sections: ['models'], expected: CARTESIA_MODELS_LINKS },
      { sections: ['general', 'tts'], expected: [...CARTESIA_GENERAL_LINKS, ...CARTESIA_TTS_LINKS], outputFileName: 'cartesia-general-tts-links.md' }
    ],
    invalid: { sections: ['stt'], message: 'Unknown links section(s) for --cartesia: stt' }
  },
  {
    name: 'links selector accepts speechify provider with models and tts sections',
    provider: 'speechify',
    all: { expected: SPEECHIFY_ALL_LINKS },
    selections: [
      { sections: ['tts'], expected: SPEECHIFY_TTS_LINKS },
      { sections: ['models'], expected: SPEECHIFY_MODELS_LINKS }
    ],
    invalid: { sections: ['general'], message: 'Unknown links section(s) for --speechify: general' }
  },
  {
    name: 'links selector accepts hume provider with general and tts sections',
    provider: 'hume',
    all: { expected: [...HUME_GENERAL_LINKS, ...HUME_TTS_LINKS], outputFileName: 'hume-all-links.md' },
    selections: [
      { sections: ['tts'], expected: HUME_TTS_LINKS, outputFileName: 'hume-tts-links.md' },
      { sections: ['general', 'tts'], expected: [...HUME_GENERAL_LINKS, ...HUME_TTS_LINKS], outputFileName: 'hume-general-tts-links.md' }
    ],
    invalid: { sections: ['stt'], message: 'Unknown links section(s) for --hume: stt' }
  },
  {
    name: 'links selector accepts inworld provider with general models and tts sections',
    provider: 'inworld',
    all: { expected: INWORLD_ALL_LINKS, outputFileName: 'inworld-all-links.md' },
    selections: [
      { sections: ['tts'], expected: INWORLD_TTS_LINKS, outputFileName: 'inworld-tts-links.md' },
      { sections: ['models'], expected: INWORLD_MODELS_LINKS },
      { sections: ['general', 'tts'], expected: [...INWORLD_GENERAL_LINKS, ...INWORLD_TTS_LINKS], outputFileName: 'inworld-general-tts-links.md' }
    ],
    invalid: { sections: ['stt'], message: 'Unknown links section(s) for --inworld: stt' }
  },
  {
    name: 'links selector accepts deapi provider with general models and stt sections',
    provider: 'deapi',
    all: { expected: DEAPI_ALL_LINKS, outputFileName: 'deapi-all-links.md' },
    selections: [
      { sections: ['stt'], expected: DEAPI_STT_LINKS, outputFileName: 'deapi-stt-links.md' },
      { sections: ['models'], expected: DEAPI_MODELS_LINKS },
      { sections: ['general', 'stt'], expected: [...DEAPI_GENERAL_LINKS, ...DEAPI_STT_LINKS], outputFileName: 'deapi-general-stt-links.md' }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --deapi: tts' }
  },
  {
    name: 'links selector accepts grok provider with models and tts sections',
    provider: 'grok',
    all: { expected: GROK_ALL_LINKS },
    selections: [
      { sections: ['models'], expected: GROK_MODELS_LINKS },
      { sections: ['tts'], expected: GROK_TTS_LINKS },
      { sections: ['stt'], expected: GROK_STT_LINKS }
    ],
    invalid: { sections: ['ocr'], message: 'Unknown links section(s) for --grok: ocr' }
  },
  {
    name: 'links selector accepts together provider with general models stt and text sections',
    provider: 'together',
    all: { expected: TOGETHER_ALL_LINKS, outputFileName: 'together-all-links.md' },
    selections: [
      { sections: ['text'], expected: TOGETHER_TEXT_LINKS, outputFileName: 'together-text-links.md' },
      { sections: ['models'], expected: TOGETHER_MODELS_LINKS },
      { sections: ['general', 'text'], expected: [...TOGETHER_GENERAL_LINKS, ...TOGETHER_TEXT_LINKS], outputFileName: 'together-general-text-links.md' }
    ],
    invalid: { sections: ['ocr'], message: 'Unknown links section(s) for --together: ocr' }
  },
  {
    name: 'links selector accepts mistral provider with general models stt ocr and tts sections',
    provider: 'mistral',
    all: { expected: MISTRAL_ALL_LINKS },
    selections: [
      { sections: ['models'], expected: MISTRAL_MODELS_LINKS },
      { sections: ['stt', 'ocr', 'tts'], expected: [...MISTRAL_STT_LINKS, ...MISTRAL_OCR_LINKS, ...MISTRAL_TTS_LINKS] }
    ]
  }
])
