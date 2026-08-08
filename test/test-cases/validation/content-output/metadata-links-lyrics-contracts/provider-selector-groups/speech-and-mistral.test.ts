import { expect, test } from 'bun:test'
import { expectLinksUsageError } from '../links-usage-errors'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv,
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  CARTESIA_ALL_LINKS,
  CARTESIA_GENERAL_LINKS,
  CARTESIA_MODELS_LINKS,
  CARTESIA_TTS_LINKS,
  DEAPI_ALL_LINKS,
  DEAPI_MODELS_LINKS,
  DEAPI_STT_LINKS,
  GROK_ALL_LINKS,
  GROK_MODELS_LINKS,
  GROK_STT_LINKS,
  GROK_TTS_LINKS,
  HUME_GENERAL_LINKS,
  HUME_TTS_LINKS,
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

test('links selector accepts cartesia provider with general models and tts sections', async () => {
  const cartesiaSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia'
  ])

  expect(cartesiaSelection.serviceSelections.get('cartesia')).toEqual([])
  expect(collectLinks(
    cartesiaSelection.serviceSelections,
    cartesiaSelection.globalSections
  )).toEqual(CARTESIA_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    cartesiaSelection.serviceSelections,
    cartesiaSelection.globalSections
  )).toBe('cartesia-all-links.md')

  const cartesiaTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia',
    'tts'
  ])

  expect(collectLinks(
    cartesiaTtsSelection.serviceSelections,
    cartesiaTtsSelection.globalSections
  )).toEqual(CARTESIA_TTS_LINKS)
  expect(getDefaultLinksOutputFileName(
    cartesiaTtsSelection.serviceSelections,
    cartesiaTtsSelection.globalSections
  )).toBe('cartesia-tts-links.md')

  const cartesiaModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia',
    'models'
  ])

  expect(collectLinks(
    cartesiaModelsSelection.serviceSelections,
    cartesiaModelsSelection.globalSections
  )).toEqual(CARTESIA_MODELS_LINKS)

  const cartesiaGeneralTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia',
    'general',
    'tts'
  ])

  expect(collectLinks(
    cartesiaGeneralTtsSelection.serviceSelections,
    cartesiaGeneralTtsSelection.globalSections
  )).toEqual([...CARTESIA_GENERAL_LINKS, ...CARTESIA_TTS_LINKS])
  expect(getDefaultLinksOutputFileName(
    cartesiaGeneralTtsSelection.serviceSelections,
    cartesiaGeneralTtsSelection.globalSections
  )).toBe('cartesia-general-tts-links.md')

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--cartesia',
    'stt'
  ], 'Unknown links section(s) for --cartesia: stt')
})

test('links selector accepts speechify provider with models and tts sections', async () => {
  const speechifySelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechify'
  ])

  expect(speechifySelection.serviceSelections.get('speechify')).toEqual([])
  expect(collectLinks(
    speechifySelection.serviceSelections,
    speechifySelection.globalSections
  )).toEqual(SPEECHIFY_ALL_LINKS)

  const speechifyTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechify',
    'tts'
  ])

  expect(collectLinks(
    speechifyTtsSelection.serviceSelections,
    speechifyTtsSelection.globalSections
  )).toEqual(SPEECHIFY_TTS_LINKS)

  const speechifyModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechify',
    'models'
  ])

  expect(collectLinks(
    speechifyModelsSelection.serviceSelections,
    speechifyModelsSelection.globalSections
  )).toEqual(SPEECHIFY_MODELS_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--speechify',
    'general'
  ], 'Unknown links section(s) for --speechify: general')
})

test('links selector accepts hume provider with general and tts sections', async () => {
  const humeSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume'
  ])

  expect(humeSelection.serviceSelections.get('hume')).toEqual([])
  expect(collectLinks(
    humeSelection.serviceSelections,
    humeSelection.globalSections
  )).toEqual([...HUME_GENERAL_LINKS, ...HUME_TTS_LINKS])
  expect(getDefaultLinksOutputFileName(
    humeSelection.serviceSelections,
    humeSelection.globalSections
  )).toBe('hume-all-links.md')

  const humeTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume',
    'tts'
  ])

  expect(collectLinks(
    humeTtsSelection.serviceSelections,
    humeTtsSelection.globalSections
  )).toEqual(HUME_TTS_LINKS)
  expect(getDefaultLinksOutputFileName(
    humeTtsSelection.serviceSelections,
    humeTtsSelection.globalSections
  )).toBe('hume-tts-links.md')

  const humeGeneralTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume',
    'general',
    'tts'
  ])

  expect(collectLinks(
    humeGeneralTtsSelection.serviceSelections,
    humeGeneralTtsSelection.globalSections
  )).toEqual([...HUME_GENERAL_LINKS, ...HUME_TTS_LINKS])
  expect(getDefaultLinksOutputFileName(
    humeGeneralTtsSelection.serviceSelections,
    humeGeneralTtsSelection.globalSections
  )).toBe('hume-general-tts-links.md')

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--hume',
    'stt'
  ], 'Unknown links section(s) for --hume: stt')
})

test('links selector accepts deapi provider with models and stt sections', async () => {
  const deapiSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--deapi'
  ])

  expect(deapiSelection.serviceSelections.get('deapi')).toEqual([])
  expect(collectLinks(
    deapiSelection.serviceSelections,
    deapiSelection.globalSections
  )).toEqual(DEAPI_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    deapiSelection.serviceSelections,
    deapiSelection.globalSections
  )).toBe('deapi-all-links.md')

  const deapiSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--deapi',
    'stt'
  ])

  expect(collectLinks(
    deapiSttSelection.serviceSelections,
    deapiSttSelection.globalSections
  )).toEqual(DEAPI_STT_LINKS)
  expect(getDefaultLinksOutputFileName(
    deapiSttSelection.serviceSelections,
    deapiSttSelection.globalSections
  )).toBe('deapi-stt-links.md')

  const deapiModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--deapi',
    'models'
  ])

  expect(collectLinks(
    deapiModelsSelection.serviceSelections,
    deapiModelsSelection.globalSections
  )).toEqual(DEAPI_MODELS_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--deapi',
    'general'
  ], 'Unknown links section(s) for --deapi: general')
})

test('links selector accepts grok provider with models and tts sections', async () => {
  const grokSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok'
  ])

  expect(grokSelection.serviceSelections.get('grok')).toEqual([])
  expect(collectLinks(
    grokSelection.serviceSelections,
    grokSelection.globalSections
  )).toEqual(GROK_ALL_LINKS)

  const grokModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok',
    'models'
  ])

  expect(collectLinks(
    grokModelsSelection.serviceSelections,
    grokModelsSelection.globalSections
  )).toEqual(GROK_MODELS_LINKS)

  const grokTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok',
    'tts'
  ])

  expect(collectLinks(
    grokTtsSelection.serviceSelections,
    grokTtsSelection.globalSections
  )).toEqual(GROK_TTS_LINKS)

  const grokSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok',
    'stt'
  ])

  expect(collectLinks(
    grokSttSelection.serviceSelections,
    grokSttSelection.globalSections
  )).toEqual(GROK_STT_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--grok',
    'ocr'
  ], 'Unknown links section(s) for --grok: ocr')
})

test('links selector accepts together provider with general models stt and text sections', async () => {
  const togetherSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--together'
  ])

  expect(togetherSelection.serviceSelections.get('together')).toEqual([])
  expect(collectLinks(
    togetherSelection.serviceSelections,
    togetherSelection.globalSections
  )).toEqual(TOGETHER_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    togetherSelection.serviceSelections,
    togetherSelection.globalSections
  )).toBe('together-all-links.md')

  const togetherTextSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--together',
    'text'
  ])

  expect(collectLinks(
    togetherTextSelection.serviceSelections,
    togetherTextSelection.globalSections
  )).toEqual(TOGETHER_TEXT_LINKS)
  expect(getDefaultLinksOutputFileName(
    togetherTextSelection.serviceSelections,
    togetherTextSelection.globalSections
  )).toBe('together-text-links.md')

  const togetherModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--together',
    'models'
  ])

  expect(collectLinks(
    togetherModelsSelection.serviceSelections,
    togetherModelsSelection.globalSections
  )).toEqual(TOGETHER_MODELS_LINKS)

  const togetherGeneralTextSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--together',
    'general',
    'text'
  ])

  expect(collectLinks(
    togetherGeneralTextSelection.serviceSelections,
    togetherGeneralTextSelection.globalSections
  )).toEqual([...TOGETHER_GENERAL_LINKS, ...TOGETHER_TEXT_LINKS])
  expect(getDefaultLinksOutputFileName(
    togetherGeneralTextSelection.serviceSelections,
    togetherGeneralTextSelection.globalSections
  )).toBe('together-general-text-links.md')

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--together',
    'ocr'
  ], 'Unknown links section(s) for --together: ocr')
})

test('links selector accepts mistral provider with general models stt ocr and tts sections', () => {
  const mistralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--mistral'
  ])

  expect(mistralSelection.serviceSelections.get('mistral')).toEqual([])
  expect(collectLinks(
    mistralSelection.serviceSelections,
    mistralSelection.globalSections
  )).toEqual(MISTRAL_ALL_LINKS)

  const mistralModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--mistral',
    'models'
  ])

  expect(collectLinks(
    mistralModelsSelection.serviceSelections,
    mistralModelsSelection.globalSections
  )).toEqual(MISTRAL_MODELS_LINKS)

  const mistralSttOcrTtsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--mistral',
    'stt',
    'ocr',
    'tts'
  ])

  expect(collectLinks(
    mistralSttOcrTtsSelection.serviceSelections,
    mistralSttOcrTtsSelection.globalSections
  )).toEqual([...MISTRAL_STT_LINKS, ...MISTRAL_OCR_LINKS, ...MISTRAL_TTS_LINKS])
})
