import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import type { MetricContext, ReportTestContext, ServiceModelPair } from '~/types'

const COMMAND_KIND_NAMES = new Set(['setup', 'download', 'extract', 'write', 'tts', 'image', 'video', 'music'])

const MEDIA_INPUT_PATTERN = /\.(?:mp3|m4a|aac|wav|flac|ogg|opus|webm|mp4|mov|mkv|avi|m4v)(?:[?#]|$)/i
const DOCUMENT_INPUT_PATTERN = /\.(?:pdf|epub|mobi|prc|azw3?|fb2|lit|docx|pptx|xlsx|odt|ods|odp|rtf|csv|cbz|png|jpe?g|tiff?|webp|bmp|gif)(?:[?#]|$)/i

// Live write-step selectors (src/cli/flags/shared-flags.ts stepProviderSelectorFlags).
const STEP_SELECTOR_KINDS: Record<string, string> = {
  '--stt': 'transcribe',
  '--ocr': 'extract',
  '--llm': 'write',
  '--tts': 'tts',
  '--image': 'image',
  '--video': 'video',
  '--music': 'music',
}

// Mirrors the canonical backend list in src/utils/extraction-provider-model.ts. `glm-reader`
// is reported under service `glm` so it keeps matching the `glm` service hint below.
const URL_BACKEND_PAIRS: Array<[backend: string, service: string, model: string]> = [
  ['defuddle', 'defuddle', 'defuddle'],
  ['firecrawl', 'firecrawl', 'firecrawl'],
  ['glm-reader', 'glm', 'glm-reader'],
  ['spider', 'spider', 'spider'],
  ['supadata', 'supadata', 'supadata'],
  ['zyte', 'zyte', 'zyte'],
]

const OCR_METHOD_SERVICES: Array<[method: string, service: string]> = [
  ['mistral-ocr', 'mistral'],
  ['glm-ocr', 'glm'],
  ['kimi-ocr', 'kimi'],
  ['openai-ocr', 'openai'],
  ['anthropic-ocr', 'anthropic'],
  ['gemini-ocr', 'gemini'],
  ['deepinfra-ocr', 'deepinfra'],
]

const KNOWN_SERVICE_HINTS: Array<{ pattern: RegExp, service: string }> = [
  { pattern: /\bopenai\b/i, service: 'openai' },
  { pattern: /\banthropic\b/i, service: 'anthropic' },
  { pattern: /\bgemini\b/i, service: 'gemini' },
  { pattern: /\bgroq\b/i, service: 'groq' },
  { pattern: /\bgrok\b/i, service: 'grok' },
  { pattern: /\bminimax\b/i, service: 'minimax' },
  { pattern: /\belevenlabs\b/i, service: 'elevenlabs' },
  { pattern: /\bdeepgram\b/i, service: 'deepgram' },
  { pattern: /\bhume\b/i, service: 'hume' },
  { pattern: /\bcartesia\b/i, service: 'cartesia' },
  { pattern: /\bdeepinfra\b/i, service: 'deepinfra' },
  { pattern: /\bsoniox\b/i, service: 'soniox' },
  { pattern: /\bspeechmatics\b/i, service: 'speechmatics' },
  { pattern: /\brev\b/i, service: 'rev' },
  { pattern: /\bassemblyai\b/i, service: 'assemblyai' },
  { pattern: /\bgladia\b/i, service: 'gladia' },
  { pattern: /\bhappyscribe\b/i, service: 'happyscribe' },
  { pattern: /\bhappy scribe\b/i, service: 'happyscribe' },
  { pattern: /\bmistral\b/i, service: 'mistral' },
  { pattern: /\bsupadata\b/i, service: 'supadata' },
  { pattern: /\bscrapecreators\b/i, service: 'scrapecreators' },
  { pattern: /\bscrape creators\b/i, service: 'scrapecreators' },
  { pattern: /\bfirecrawl\b/i, service: 'firecrawl' },
  { pattern: /\bglm(?:-reader)?\b/i, service: 'glm' },
  { pattern: /\bkimi\b/i, service: 'kimi' },
  { pattern: /\brunway\b/i, service: 'runway' },
  { pattern: /\bwhisper\b/i, service: 'whisper' },
  { pattern: /\bllama\b/i, service: 'llama.cpp' },
  { pattern: /\bkitten\b/i, service: 'kitten' },
]

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const cleanValue = (value: string | null | undefined): string | null => {
  if (!value) return null
  const cleaned = value.trim()
  return cleaned.length > 0 ? cleaned : null
}

export const normalizeValue = (value: string | null | undefined): string | null => {
  const cleaned = cleanValue(value)
  return cleaned ? cleaned.toLowerCase() : null
}

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}

const dedupePairs = (pairs: ServiceModelPair[]): ServiceModelPair[] => {
  const seen = new Set<string>()
  const out: ServiceModelPair[] = []

  for (const pair of pairs) {
    const key = `${pair.kind ?? ''}::${normalizeValue(pair.service) ?? ''}::${normalizeValue(pair.model) ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(pair)
  }

  return out
}

const pushPair = (
  pairs: ServiceModelPair[],
  kind: string | null,
  service: string | null | undefined,
  model: string | null | undefined
): void => {
  const cleanedService = cleanValue(service)
  if (!cleanedService) return

  pairs.push({
    kind,
    service: cleanedService,
    model: cleanValue(model),
  })
}

export const isE2ETestFile = (file: string): boolean => file.startsWith('test/test-cases/e2e/')

export const isControlE2ETest = (name: string): boolean => {
  return /^rejects\b/i.test(name)
    || /^requires\b/i.test(name)
}

// Only resolves kinds the CLI actually names. `resume` is deliberately absent, so provider
// pairs harvested from a `resume` invocation stay unlabelled instead of being called `write`.
const resolveExplicitCommandKind = (metric: ParsedCommandMetric): string | null => {
  return metric.args.find(arg => COMMAND_KIND_NAMES.has(arg)) ?? null
}

const parseMetricCommandKind = (metric: ParsedCommandMetric): string | null => {
  const subcommand = resolveExplicitCommandKind(metric)
  if (subcommand) {
    return subcommand
  }

  if (metric.args.length > 1) {
    return 'write'
  }

  return null
}

const getMetricCommandInput = (metric: ParsedCommandMetric): string | null => {
  const commandIndex = metric.args.findIndex(arg => COMMAND_KIND_NAMES.has(arg))
  if (commandIndex < 0) return null

  for (let index = commandIndex + 1; index < metric.args.length; index++) {
    const arg = metric.args[index]
    if (!arg || arg.startsWith('--')) {
      continue
    }

    const previous = metric.args[index - 1]
    if (previous?.startsWith('--')) {
      continue
    }

    return arg
  }

  return null
}

const inferExtractRouteKind = (metric: ParsedCommandMetric): 'transcribe' | 'extract' | null => {
  const input = getMetricCommandInput(metric)
  if (!input) return null

  if (MEDIA_INPUT_PATTERN.test(input) || /\b(?:youtube\.com|youtu\.be|twitch\.tv)\b/i.test(input)) {
    return 'transcribe'
  }

  if (DOCUMENT_INPUT_PATTERN.test(input)) {
    return 'extract'
  }

  return null
}

const splitProviderSpec = (spec: string): { service: string, model: string | null } => {
  const separator = spec.indexOf('=')
  if (separator < 0) return { service: spec, model: null }
  return { service: spec.slice(0, separator), model: spec.slice(separator + 1) || null }
}

const resolveUrlBackendPair = (backend: string): { service: string, model: string } => {
  for (const [name, service, model] of URL_BACKEND_PAIRS) {
    if (name === backend) return { service, model }
  }
  return { service: backend, model: backend }
}

const buildPairsFromMetricArgs = (metric: ParsedCommandMetric): ServiceModelPair[] => {
  const pairs: ServiceModelPair[] = []
  const commandKind = resolveExplicitCommandKind(metric)

  for (let index = 0; index < metric.args.length; index++) {
    const arg = metric.args[index]
    if (!arg) continue

    const next = metric.args[index + 1]
    if (!next || next.startsWith('--')) continue

    if (arg === '--url-provider') {
      const { service, model } = resolveUrlBackendPair(splitProviderSpec(next).service)
      pushPair(pairs, 'extract', service, model)
      index++
      continue
    }

    const stepKind = STEP_SELECTOR_KINDS[arg]
    if (stepKind !== undefined) {
      const { service, model } = splitProviderSpec(next)
      pushPair(pairs, stepKind, service, model)
      index++
      continue
    }

    if (arg === '--provider') {
      const { service, model } = splitProviderSpec(next)
      if (commandKind === 'extract') {
        const routeKind = inferExtractRouteKind(metric)
        if (routeKind) {
          pushPair(pairs, routeKind, service, model)
        } else {
          pushPair(pairs, 'transcribe', service, model)
          pushPair(pairs, 'extract', service, model)
        }
      } else {
        pushPair(pairs, commandKind, service, model)
      }
      index++
    }
  }

  return dedupePairs(pairs)
}

const resolveStep2ExtractPair = (step2: Record<string, unknown>): { service: string | null, model: string | null } => {
  const extractionMethod = typeof step2['extractionMethod'] === 'string' ? step2['extractionMethod'] : null
  const ocrService = typeof step2['ocrService'] === 'string' ? step2['ocrService'] : null
  const ocrModel = typeof step2['ocrModel'] === 'string' ? step2['ocrModel'] : null

  if (extractionMethod) {
    for (const [backend, service, model] of URL_BACKEND_PAIRS) {
      if (extractionMethod.includes(`html+${backend}`)) {
        return { service, model }
      }
    }
  }

  if (ocrService) {
    return { service: ocrService, model: ocrModel }
  }

  if (extractionMethod) {
    for (const [method, service] of OCR_METHOD_SERVICES) {
      if (extractionMethod.includes(method)) {
        return { service, model: ocrModel }
      }
    }
  }

  return { service: null, model: null }
}

const extractPairsFromMetadata = (metadata: Record<string, unknown>): ServiceModelPair[] => {
  const pairs: ServiceModelPair[] = []

  const step2Entries = toRecordArray(metadata['step2'])
  const step3Entries = toRecordArray(metadata['step3'])
  const step4Entries = toRecordArray(metadata['step4'])
  const musicEntries = [
    ...toRecordArray(metadata['step7']),
    ...toRecordArray(metadata['music'])
  ]
  const ttsEntries = toRecordArray(metadata['tts'])
  const imageEntries = [
    ...toRecordArray(metadata['step5']),
    ...toRecordArray(metadata['image'])
  ]
  const videoEntries = [
    ...toRecordArray(metadata['step6']),
    ...toRecordArray(metadata['video'])
  ]

  for (const step2 of step2Entries) {
    pushPair(
      pairs,
      'transcribe',
      typeof step2['transcriptionService'] === 'string' ? step2['transcriptionService'] : null,
      typeof step2['transcriptionModel'] === 'string' ? step2['transcriptionModel'] : null
    )

    const extractPair = resolveStep2ExtractPair(step2)
    pushPair(pairs, 'extract', extractPair.service, extractPair.model)
  }

  for (const step3 of step3Entries) {
    pushPair(
      pairs,
      'write',
      typeof step3['llmService'] === 'string' ? step3['llmService'] : null,
      typeof step3['llmModel'] === 'string' ? step3['llmModel'] : null
    )
  }

  for (const step4 of step4Entries) {
    pushPair(
      pairs,
      'tts',
      typeof step4['ttsService'] === 'string' ? step4['ttsService'] : null,
      typeof step4['ttsModel'] === 'string' ? step4['ttsModel'] : null
    )
  }

  for (const music of musicEntries) {
    pushPair(
      pairs,
      'music',
      typeof music['musicService'] === 'string' ? music['musicService'] : null,
      typeof music['musicModel'] === 'string' ? music['musicModel'] : null
    )
  }

  for (const tts of ttsEntries) {
    pushPair(
      pairs,
      'tts',
      typeof tts['ttsService'] === 'string' ? tts['ttsService'] : null,
      typeof tts['ttsModel'] === 'string' ? tts['ttsModel'] : null
    )
  }

  for (const image of imageEntries) {
    pushPair(
      pairs,
      'image',
      typeof image['imageService'] === 'string' ? image['imageService'] : null,
      typeof image['imageModel'] === 'string' ? image['imageModel'] : null
    )
  }

  for (const video of videoEntries) {
    pushPair(
      pairs,
      'video',
      typeof video['videoGenService'] === 'string'
        ? video['videoGenService']
        : typeof video['videoService'] === 'string' ? video['videoService'] : null,
      typeof video['videoGenModel'] === 'string'
        ? video['videoGenModel']
        : typeof video['videoModel'] === 'string' ? video['videoModel'] : null
    )
  }

  return dedupePairs(pairs)
}

// Matches sanitizeOutputRootSegment in test/test-utils/test-helpers.ts, which names the
// canonical manifest copies under `<runDir>/run/`.
const sanitizeArtifactSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'run'

// Mirrors unwrapCanonicalRecordValue in test/test-utils/manifest-helpers.ts.
const unwrapManifestMetadata = (value: Record<string, unknown>): Record<string, unknown> => {
  const items = value['items']
  if (
    typeof value['command'] === 'string'
    && (value['scope'] === 'single' || value['scope'] === 'batch')
    && Array.isArray(items)
    && items.length === 1
    && isRecord(items[0])
    && isRecord(items[0]['metadata'])
  ) {
    return items[0]['metadata']
  }
  return value
}

const buildMetricMetadataPaths = (metric: ParsedCommandMetric, artifacts: TestRunArtifacts): string[] => {
  if (!metric.outputDir) return []

  const absoluteOutputDir = isAbsolute(metric.outputDir)
    ? metric.outputDir
    : resolve(process.cwd(), metric.outputDir)
  const paths = [resolve(absoluteOutputDir, 'manifest.json')]

  const outputRoot = metric.outputRoot
  if (outputRoot) {
    const absoluteOutputRoot = isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot)
    const copyName = [
      sanitizeArtifactSegment(basename(absoluteOutputRoot)),
      sanitizeArtifactSegment(basename(absoluteOutputDir)),
    ].join('-')
    paths.push(resolve(artifacts.runDir, 'run', `${copyName}.json`))
  }

  return paths
}

const getMetricMetadata = async (
  metric: ParsedCommandMetric,
  artifacts: TestRunArtifacts,
  cache: Map<string, Record<string, unknown> | null>
): Promise<Record<string, unknown> | null> => {
  if (!metric.outputDir) return null

  // Keyed on the fully-qualified output dir: basenames such as `downloaded_audio` and
  // `1-document` repeat across parallel workers and would cross-attribute metadata.
  const key = `${metric.outputRoot ?? ''}::${metric.outputDir}`
  if (cache.has(key)) {
    return cache.get(key) ?? null
  }

  for (const metadataPath of buildMetricMetadataPaths(metric, artifacts)) {
    try {
      const parsed = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown
      if (isRecord(parsed)) {
        const record = unwrapManifestMetadata(parsed)
        cache.set(key, record)
        return record
      }
    } catch {
    }
  }

  cache.set(key, null)
  return null
}

export const buildMetricContext = async (
  metric: ParsedCommandMetric,
  artifacts: TestRunArtifacts,
  metadataCache: Map<string, Record<string, unknown> | null>
): Promise<MetricContext> => {
  const metadata = await getMetricMetadata(metric, artifacts, metadataCache)
  const pairs = dedupePairs([
    ...extractPairsFromMetadata(metadata ?? {}),
    ...buildPairsFromMetricArgs(metric),
  ])

  return {
    metric,
    kind: parseMetricCommandKind(metric),
    isPrice: metric.args.includes('--price'),
    pairs,
  }
}

export const inferTestKind = (testCase: ParsedJunitCase): string | null => {
  if (testCase.file.includes('/step-7-music-gen-e2e/')) return 'music'
  if (testCase.file.includes('/step-6-video-gen-e2e/')) return 'video'
  if (testCase.file.includes('/step-5-image-gen-e2e/')) return 'image'
  if (testCase.file.includes('/step-4-tts-e2e/')) return 'tts'
  if (testCase.file.includes('/step-3-write-e2e/')) return 'write'
  if (testCase.file.includes('/step-2-stt-e2e/')) return 'transcribe'
  if (testCase.file.includes('/step-2-ocr-e2e/')) return 'extract'
  if (/\btranscribe\b/i.test(testCase.name)) return 'transcribe'
  if (/\bextract\b/i.test(testCase.name)) return 'extract'
  if (/\btts\b/i.test(testCase.name) || /speech\.wav/i.test(testCase.name)) return 'tts'
  if (/\bimage\b/i.test(testCase.name) || /generated-image/i.test(testCase.name)) return 'image'
  if (/\bvideo\b/i.test(testCase.name) || /\bveo\b/i.test(testCase.name)) return 'video'
  if (/\bmusic\b/i.test(testCase.name) || /generated music/i.test(testCase.name)) return 'music'
  return null
}

const inferServiceHints = (testCase: ParsedJunitCase): Set<string> => {
  const text = `${testCase.file} ${testCase.name}`
  const services = new Set<string>()

  for (const hint of KNOWN_SERVICE_HINTS) {
    if (hint.pattern.test(text)) {
      services.add(hint.service)
    }
  }

  return services
}

const addModelHint = (models: Set<string>, value: string | null | undefined): void => {
  const normalized = normalizeValue(value)
  if (normalized) {
    models.add(normalized)
  }
}

const inferModelHints = (testCase: ParsedJunitCase): Set<string> => {
  const models = new Set<string>()
  const name = testCase.name

  addModelHint(models, name.match(/^([A-Za-z0-9./_-]+) (?:model generates|generates|runs in parallel)/i)?.[1])

  for (const match of name.matchAll(/--[a-z-]+\s+([A-Za-z0-9./_-]+)/gi)) {
    addModelHint(models, match[1])
  }

  return models
}

export const buildTestContext = (testCase: ParsedJunitCase): ReportTestContext => {
  return {
    testCase,
    kind: inferTestKind(testCase),
    isPrice: /\bprice\b/i.test(testCase.name),
    serviceHints: inferServiceHints(testCase),
    modelHints: inferModelHints(testCase),
  }
}

export const selectPrimaryPairs = (testCase: ParsedJunitCase, pairs: ServiceModelPair[]): ServiceModelPair[] => {
  const deduped = dedupePairs(pairs)
  if (deduped.length === 0) return []

  const kind = inferTestKind(testCase)
  if (!kind) return deduped

  const kindMatches = deduped.filter(pair => pair.kind === kind)
  return kindMatches.length > 0 ? kindMatches : deduped
}

export const joinUnique = (values: Array<string | null>): string | null => {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
  return unique.length > 0 ? unique.join(', ') : null
}
