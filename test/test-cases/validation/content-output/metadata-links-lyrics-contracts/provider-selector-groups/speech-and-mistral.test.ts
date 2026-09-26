import {
  GROK_ALL_LINKS,
  GROK_MODELS_LINKS,
  GROK_STT_LINKS,
  GROK_TTS_LINKS,
  INWORLD_ALL_LINKS,
  INWORLD_GENERAL_LINKS,
  INWORLD_MODELS_LINKS,
  INWORLD_TTS_LINKS,
  MISTRAL_ALL_LINKS,
  MISTRAL_MODELS_LINKS,
  MISTRAL_OCR_LINKS,
  MISTRAL_STT_LINKS,
  TOGETHER_ALL_LINKS,
  TOGETHER_GENERAL_LINKS,
  TOGETHER_MODELS_LINKS,
  TOGETHER_TEXT_LINKS
} from './fixtures/index'
import { registerProviderSelectorCases } from './provider-selector-cases'

registerProviderSelectorCases([
  {
    name: 'links selector accepts inworld provider with general models and tts sections',
    provider: 'inworld',
    all: { expected: INWORLD_ALL_LINKS, outputFileName: 'inworld-all-links.md' },
    selections: [
      { sections: ['tts'], expected: INWORLD_TTS_LINKS, outputFileName: 'inworld-tts-links.md' },
      { sections: ['models'], expected: INWORLD_MODELS_LINKS },
      { sections: ['general', 'tts'], expected: [...INWORLD_GENERAL_LINKS, ...INWORLD_TTS_LINKS], outputFileName: 'inworld-general-tts-links.md' }
    ],
    invalid: { sections: ['stt'], message: 'Unknown links section(s) for --provider inworld: stt' }
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
    invalid: { sections: ['music'], message: 'Unknown links section(s) for --provider grok: music' }
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
    invalid: { sections: ['ocr'], message: 'Unknown links section(s) for --provider together: ocr' }
  },
  {
    name: 'links selector accepts mistral provider with general models stt and ocr sections',
    provider: 'mistral',
    all: { expected: MISTRAL_ALL_LINKS },
    selections: [
      { sections: ['models'], expected: MISTRAL_MODELS_LINKS },
      { sections: ['stt', 'ocr'], expected: [...MISTRAL_STT_LINKS, ...MISTRAL_OCR_LINKS] }
    ]
  }
])
