import { describe, expect, test } from 'bun:test'
import {
  getExtractPricing,
  getImageCost,
  getLlmCost,
  getModelRegistry,
  getMusicModelMeta,
  getTtsPricing,
  getVideoModelMeta,
  hasRetiredModelRate,
  RETIRED_MODEL_RATES,
  getRetiredModelReplacement
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ModelCategory } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveTranscriptionModel } from '~/cli/commands/pricing-orchestration/run-step-walk'
import type { Step2Metadata } from '~/types'

type ModelIdentitySpec = {
  category: ModelCategory
  serviceField: string
  modelField: string
}

type HistoricalIdentity = {
  category: ModelCategory
  service: string
  model: string
  file: string
}

const MODEL_IDENTITY_SPECS: readonly ModelIdentitySpec[] = [
  { category: 'stt', serviceField: 'transcriptionService', modelField: 'transcriptionModel' },
  { category: 'extract', serviceField: 'ocrService', modelField: 'ocrModel' },
  { category: 'llm', serviceField: 'llmService', modelField: 'llmModel' },
  { category: 'tts', serviceField: 'ttsService', modelField: 'ttsModel' },
  { category: 'image', serviceField: 'imageService', modelField: 'imageModel' },
  { category: 'video', serviceField: 'videoGenService', modelField: 'videoGenModel' },
  { category: 'music', serviceField: 'musicService', modelField: 'musicModel' }
]

const MINIMAX_01_SERIES_MODELS = [
  'T2V-01',
  'T2V-01-Director',
  'I2V-01',
  'I2V-01-live',
  'I2V-01-Director',
  'S2V-01'
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const collectModelIdentities = (
  value: unknown,
  file: string,
  identities: HistoricalIdentity[]
): void => {
  if (Array.isArray(value)) {
    for (const entry of value) collectModelIdentities(entry, file, identities)
    return
  }
  if (!isRecord(value)) return

  for (const spec of MODEL_IDENTITY_SPECS) {
    const service = value[spec.serviceField]
    const model = value[spec.modelField]
    if (typeof service === 'string' && typeof model === 'string') {
      identities.push({ category: spec.category, service, model, file })
    }
  }
  for (const child of Object.values(value)) collectModelIdentities(child, file, identities)
}

const normalizeHistoricalIdentity = (
  identity: HistoricalIdentity
): HistoricalIdentity => {
  if (identity.category === 'stt' && identity.service === 'whisper') {
    const model = resolveTranscriptionModel({
      transcriptionService: identity.service,
      transcriptionModel: identity.model
    } as Step2Metadata)
    return { ...identity, model }
  }
  return identity
}

const isActiveModel = (identity: HistoricalIdentity): boolean => {
  const categoryRegistry = getModelRegistry()[identity.category] as Record<
    string,
    { models: Record<string, unknown> }
  >
  return categoryRegistry[identity.service]?.models[identity.model] !== undefined
}

describe('historical model rate contracts', () => {
  test('every committed benchmark step model resolves through active or retired rates', async () => {
    const identities: HistoricalIdentity[] = []
    let runCount = 0
    const glob = new Bun.Glob('docs/benchmarks/*/*/manifest.json')
    for await (const file of glob.scan({ cwd: process.cwd(), onlyFiles: true })) {
      runCount += 1
      collectModelIdentities(await Bun.file(file).json(), file, identities)
    }
    expect(runCount).toBeGreaterThan(0)

    const unresolved = identities
      .map(normalizeHistoricalIdentity)
      .filter(identity => !(identity.category === 'llm' && (identity.service === 'llama.cpp' || identity.service === 'llama' || identity.service === 'llamafile')))
      .filter(identity => !isActiveModel(identity))
      .filter(identity => !hasRetiredModelRate(identity.category, identity.service, identity.model))
      .map(identity => `${identity.category} ${identity.service}:${identity.model} (${identity.file})`)

    expect([...new Set(unresolved)].sort()).toEqual([])
  })

  test('retired rows stay outside active registries and retain category-specific cents', () => {
    for (const category of Object.keys(RETIRED_MODEL_RATES) as ModelCategory[]) {
      const categoryRegistry = getModelRegistry()[category] as Record<
        string,
        { models: Record<string, unknown> }
      >
      for (const key of Object.keys(RETIRED_MODEL_RATES[category])) {
        const separator = key.indexOf(':')
        const service = key.slice(0, separator)
        const model = key.slice(separator + 1)
        expect(categoryRegistry[service]?.models[model], `${category} ${key}`).toBeUndefined()
      }
    }

    expect(getExtractPricing('gemini', 'gemini-3.1-flash-lite-preview')).toMatchObject({
      inputCostPer1MCents: 25,
      outputCostPer1MCents: 150
    })
    expect(getLlmCost('gemini', 'gemini-3.1-flash-lite-preview')).toMatchObject({
      inputCostPer1MCents: 25,
      outputCostPer1MCents: 150
    })
    expect(getTtsPricing('openai', 'gpt-4o-mini-tts')).toMatchObject({
      inputCostPer1MCharsCents: 60,
      outputCostPer1MCharsCents: 1200
    })
    expect(getImageCost('gemini', 'gemini-3.1-flash-image-preview')).toBe(6.7)
    expect(getMusicModelMeta('elevenlabs', 'music_v1')).toMatchObject({
      costPerMinuteCents: 15
    })
    expect(getMusicModelMeta('gemini', 'lyria-3-clip-preview')).toMatchObject({
      costPerTrackCents: 4
    })
    expect(getMusicModelMeta('minimax', 'music-2.6')).toMatchObject({
      costPerTrackCents: 15,
      lyricsCostPerTrackCents: 1
    })
    expect(getVideoModelMeta('replicate', 'alibaba/happyhorse-1.0')).toMatchObject({
      costPerSecondByResolutionCents: { '720p': 14, '1080p': 28 }
    })
  })

  test('retired MiniMax 01-series benchmark rates remain available outside active enums', () => {
    for (const model of MINIMAX_01_SERIES_MODELS) {
      expect(getModelRegistry().video['minimax']?.models[model], model).toBeUndefined()
      expect(getVideoModelMeta('minimax', model), model).toMatchObject({
        blockSizeSec: 6,
        blockCost720pCents: 19
      })
    }
  })

  test('retired video selectors retain exact rates and ADR-013 replacements', () => {
    expect(getVideoModelMeta('minimax', 'MiniMax-Hailuo-2.3-Fast')).toMatchObject({
      fixedCostByResolutionDurationCents: { '720p': { '6': 19, '10': 32 }, '1080p': { '6': 33 } }
    })
    expect(getVideoModelMeta('glm', 'cogvideox-3')).toMatchObject({ baseJobFeeCents: 20 })
    expect(getVideoModelMeta('runway', 'gen4.5')).toMatchObject({ baseCostPerSecondCents: 12 })
    expect(getVideoModelMeta('replicate', 'runwayml/aleph-2')).toMatchObject({ baseCostPerSecondCents: 33.6 })
    expect(getVideoModelMeta('replicate', 'wan-video/wan-2.7-t2v')).toMatchObject({
      costPerSecondByResolutionCents: { '720p': 10, '1080p': 10 }
    })
  })

  test('retired image selectors retain exact rates and ADR-013 replacements', () => {
    expect(getImageCost('fal', 'microsoft/mai-image-2.5')).toBe(0.21)
    expect(getImageCost('fal', 'microsoft/mai-image-2.5-pro')).toBe(150)
    expect(getImageCost('replicate', 'ideogram-ai/ideogram-v4-turbo')).toBe(3)
    expect(getImageCost('replicate', 'ideogram-ai/ideogram-v4-balanced')).toBe(6)
    expect(getImageCost('replicate', 'ideogram-ai/ideogram-v4-quality')).toBe(10)
    expect(getImageCost('replicate', 'prunaai/ernie-image')).toBe(5.28)
    expect(getImageCost('replicate', 'prunaai/ernie-image-turbo')).toBe(1.15)
    expect(getImageCost('recraft', 'recraftv4_1')).toBe(4)
    expect(getImageCost('recraft', 'recraftv4_1_utility')).toBe(4)
    expect(getImageCost('recraft', 'recraftv4_1_pro')).toBe(25)
    expect(getImageCost('recraft', 'recraftv4_1_utility_pro')).toBe(25)
    expect(getImageCost('grok', 'grok-imagine-image')).toBe(2)
    expect(getRetiredModelReplacement('image', 'grok', 'grok-imagine-image')).toBe('grok-imagine-image-2.0')
    expect(getRetiredModelReplacement('image', 'recraft', 'recraftv4_1')).toBe('flux-2-klein-4b')
  })
})
