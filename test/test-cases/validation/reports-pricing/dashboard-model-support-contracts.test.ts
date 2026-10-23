import { describe, expect, spyOn, test } from 'bun:test'
import { supportedDashboardProviderKeys, type DashboardModelSupportRegistry } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_model_support'
import type { CombinedDashboardModel, DashboardProviderRow } from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { LlmRegistrySchema } from '~/cli/commands/setup-and-utilities/models/model-loader/model-loader-schemas'
import { safeParse } from 'valibot'

function row(providerKey: string, model: string): DashboardProviderRow {
  return { providerKey, display: providerKey, model, coverage: '1/1', quality: { display: '1', rank: 1 }, speed: { display: '1', rank: 1 }, cost: { display: '1', rank: 1 }, evidence: [], perRun: [] }
}

function dashboard(pairs: readonly (readonly [string, string])[], group = 'service'): CombinedDashboardModel {
  return { title: 'Availability fixture', category: 'test', generatedAt: '', rootDir: '.', summaryStats: [], runs: [], groups: [{ key: group, label: group, metricColumns: { quality: 'Quality', speed: 'Speed', cost: 'Cost' }, metricDirections: { quality: 'higher', speed: 'lower', cost: 'lower' }, evidenceColumns: [], providers: pairs.map(([key, model]) => row(key, model)) }], methodParagraphs: [], notes: [] }
}

const routePairs = (service: string, models: readonly string[]): Array<[string, string]> => models.map(model => [`${service}/${model}`, model])
const removedWrite = [
  ...routePairs('openai', ['gpt-5.5', 'gpt-5.4-mini', 'removed-openai-model']),
  ...routePairs('anthropic', ['claude-opus-4-8', 'claude-sonnet-4-6', 'removed-anthropic-model']),
  ...routePairs('gemini', ['gemini-3.1-flash-lite']),
  ...routePairs('grok', ['grok-4.3']),
  ...routePairs('glm', ['glm-5.1']),
  ...routePairs('kimi', ['removed-kimi-model']),
  ...routePairs('together', ['removed-kimi-model', 'glm-5.1']),
]
const activeWrite = [
  ...routePairs('openai', ['gpt-6.1-sol', 'gpt-6-luna']),
  ...routePairs('anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']),
  ...routePairs('gemini', ['gemini-4-argon', 'gemini-3.8-flash']),
  ...routePairs('grok', ['grok-4.7']),
]
// Gemini 4 Argon remains a write route only.
const writeOnly = new Set(['gemini/gemini-4-argon'])
const activeOcr = [
  ...activeWrite.filter(([key]) => !writeOnly.has(key)),
  ...routePairs('mistral', ['mistral-ocr-4-1']),
  ...routePairs('anthropic', ['claude-fable-5']),
]
const removedOcr = [
  ...routePairs('openai', ['removed-openai-ocr-model']),
  ...routePairs('gemini', ['gemini-4-argon', 'removed-gemini-ocr-model']),
  ...routePairs('grok', ['removed-grok-ocr-model']),
  ...routePairs('mistral', ['removed-mistral-ocr-model']),
  ...routePairs('deepinfra', ['removed/deepinfra-ocr-model']),
]
const removedStt = [
  ...routePairs('happyscribe', ['auto']),
  ...routePairs('rev', ['machine']),
  ...routePairs('supadata', ['auto']),
  ...routePairs('grok', ['speech-to-text']),
  ...routePairs('cloudflare', ['@cf/deepgram/nova-3']),
]
const diarizedStt = [
  ...routePairs('assemblyai', ['universal-3-5-pro']), ...routePairs('deepgram', ['nova-3']),
  ...routePairs('gemini-stt', ['gemini-3.5-transcribe']), ...routePairs('gladia', ['solaria-3']),
  ...routePairs('grok', ['grok-voice-transcribe-2.0']), ...routePairs('mistral', ['voxtral-mini-2602']),
  ...routePairs('soniox', ['stt-async-v5']), ...routePairs('speechmatics', ['melia-1']),
]
const nonDiarizedStt = [
  ...routePairs('cloudflare', ['@cf/openai/whisper-large-v3-turbo', '@cf/openai/whisper', '@cf/openai/whisper-tiny-en']),
  ...routePairs('deepinfra', ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3', 'Qwen/Qwen3-ASR-0.6B', 'Qwen/Qwen3-ASR-1.7B', 'mistralai/Voxtral-Mini-3B-2507', 'mistralai/Voxtral-Small-24B-2507', 'nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b']),
  ...routePairs('openai-stt', ['gpt-transcribe']),
  ...routePairs('together', ['openai/whisper-large-v3', 'nvidia/parakeet-tdt-0.6b-v3']),
]
const localStt = routePairs('whisperfile', ['tiny', 'tiny.en', 'small', 'small.en', 'medium', 'medium.en', 'large-v2', 'large-v3'])
const activeTts = [
  ...routePairs('gemini', ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']),
  ...routePairs('elevenlabs', ['eleven_v3']), ...routePairs('soniox', ['tts-rt-v2']),
  ...routePairs('grok', ['grok-tts']), ...routePairs('openai', ['gpt-4o-mini-tts-2025-12-15']),
  ...routePairs('inworld', ['realtime-tts-2']),
]

describe('benchmark dashboard live CLI availability snapshot', () => {
  const mappings = [
    { tab: 'write', active: activeWrite, retired: removedWrite },
    { tab: 'ocr', active: activeOcr, retired: [...removedWrite, ...removedOcr, ...routePairs('kimi', ['removed-kimi-ocr-model'])] },
    { tab: 'stt-local', active: localStt, retired: [...removedStt, ...diarizedStt] },
    { tab: 'stt-with-speakers', active: diarizedStt, retired: [...removedStt, ...localStt] },
    { tab: 'stt-without-speakers', active: nonDiarizedStt, retired: [...removedStt, ...localStt] },
    { tab: 'url', active: ['defuddle', 'spider', 'zyte'].map(value => [value, value] as [string, string]), retired: ['firecrawl', 'glm-reader', 'supadata'].map(value => [value, value] as [string, string]) },
    { tab: 'tts', active: activeTts, retired: [...routePairs('mistral', ['voxtral-tts']), ...routePairs('openai', ['tts-1', 'tts-1-hd'])] },
  ]

  for (const { tab, active, retired } of mappings) {
    test(`${tab} keeps current routes and excludes historical selectors without provider calls`, () => {
      const blockedFetch = Object.assign(() => { throw new Error('Availability snapshots must never call a provider') }, { preconnect: () => {} })
      const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(blockedFetch)
      try {
        const model = dashboard([...active, ...retired, ['unknown-provider/model', 'model'], ['openai/not-implemented', 'not-implemented']])
        expect(supportedDashboardProviderKeys(tab, model)).toEqual(active.map(([key]) => key).sort((a, b) => a.localeCompare(b)))
        expect(fetchSpy).not.toHaveBeenCalled()
      } finally {
        fetchSpy.mockRestore()
      }
    })
  }

  test('preserves supported local service keys only in the local group with an implemented model', () => {
    const local = dashboard([['tesseract', 'tesseract'], ['tesseract/tesseract', 'tesseract'], ['tesseract/fake', 'fake'], ['tesseract', 'fake']], 'local')
    expect(supportedDashboardProviderKeys('ocr', local)).toEqual(['tesseract', 'tesseract/tesseract'])
    expect(supportedDashboardProviderKeys('ocr', dashboard([['tesseract', 'tesseract']]))).toEqual([])
    expect(supportedDashboardProviderKeys('stt-local', dashboard([['whisperfile', 'tiny'], ['whisperfile/fake', 'fake']], 'local'))).toEqual(['whisperfile'])
    expect(supportedDashboardProviderKeys('tts', dashboard([['tesseract', 'tesseract']], 'local'))).toEqual([])
  })

  test('matches complete slash-bearing identities and fails closed for mismatched models and unknown tabs', () => {
    const model = dashboard([
      ['deepinfra/openai/whisper-large-v3', 'openai/whisper-large-v3'],
      ['deepinfra/openai/whisper-large-v3', 'not-implemented'],
      ['deepinfra/openai', 'whisper-large-v3'],
      ['openai/gpt-6-luna', 'not-implemented'],
    ])
    expect(supportedDashboardProviderKeys('stt-without-speakers', model)).toEqual(['deepinfra/openai/whisper-large-v3'])
    expect(supportedDashboardProviderKeys('write', dashboard([['openai/gpt-6-luna', 'not-implemented']]))).toEqual([])
    expect(supportedDashboardProviderKeys('unknown', model)).toEqual([])
    expect(supportedDashboardProviderKeys('url', dashboard([['spider/spider', 'spider'], ['spider', 'unknown']]))).toEqual([])
  })

  test('explicit deprecated lifecycle entries are excluded even while still selectable and registered', () => {
    const registry = structuredClone(getModelRegistry()) as DashboardModelSupportRegistry
    Object.assign(registry.llm['openai']!.models['gpt-6-luna'] as object, { lifecycle: { status: 'deprecated' } })
    Object.assign(registry.extract['grok']!.models['grok-4.7'] as object, { lifecycle: { status: 'deprecated' } })
    Object.assign(registry.tts['soniox']!.models['tts-rt-v2'] as object, { lifecycle: { status: 'deprecated' } })
    expect(supportedDashboardProviderKeys('write', dashboard(activeWrite), registry)).not.toContain('openai/gpt-6-luna')
    expect(supportedDashboardProviderKeys('ocr', dashboard(activeOcr), registry)).not.toContain('grok/grok-4.7')
    expect(supportedDashboardProviderKeys('tts', dashboard(activeTts), registry)).not.toContain('soniox/tts-rt-v2')
    expect(supportedDashboardProviderKeys('write', dashboard(activeWrite))).toContain('openai/gpt-6-luna')
  })

  test('accepts explicit active lifecycle and rejects partial lifecycle objects that the native schema disallows', () => {
    const registry = structuredClone(getModelRegistry())
    const metadata = registry.llm['openai']!.models['gpt-6-luna']!
    Object.assign(metadata, { lifecycle: { status: 'active' } })
    expect(safeParse(LlmRegistrySchema, registry.llm).success).toBe(true)
    expect(supportedDashboardProviderKeys('write', dashboard(activeWrite), registry)).toContain('openai/gpt-6-luna')
    Object.assign(metadata, { lifecycle: { defaultEligible: true } })
    expect(safeParse(LlmRegistrySchema, registry.llm).success).toBe(false)
    expect(supportedDashboardProviderKeys('write', dashboard(activeWrite), registry)).not.toContain('openai/gpt-6-luna')
  })

  test('requires both a selector and current metadata; archived rates or extra registry entries cannot revive a route', () => {
    const original = getModelRegistry()
    const registry = {
      ...original,
      llm: { ...original.llm, openai: { ...original.llm['openai']!, models: { 'gpt-5.5': {} } } },
    }
    expect(supportedDashboardProviderKeys('write', dashboard([...activeWrite, ...removedWrite]), registry)).toEqual(activeWrite.filter(([key]) => !key.startsWith('openai/')).map(([key]) => key).sort((a, b) => a.localeCompare(b)))
    expect(activeWrite).toHaveLength(8)
    expect(activeOcr).toHaveLength(9)
  })
})
