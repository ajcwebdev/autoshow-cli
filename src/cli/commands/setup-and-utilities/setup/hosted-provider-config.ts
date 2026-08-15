import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { InternalError } from '~/utils/error-handler'
import type { AutoshowConfig, HostedProviderConfigurationLogMode, HostedProviderConfigurationRow, HostedProviderConfigurationSummary, HostedProviderEnvCheck, HostedProviderStatus, HumanLogTable, TableLogger } from '~/types'
export const HOSTED_PROVIDER_ENV_CHECKS = [
  {
    envVar: 'OPENAI_API_KEY',
    label: 'OpenAI write/OCR/TTS/image',
    configPaths: [
      'defaults.llm.openai',
      'defaults.extract.ocr.openaiOcr',
      'defaults.post.tts.openaiTts',
      'defaults.post.image.openaiImage'
    ]
  },
  {
    envVar: 'XAI_API_KEY',
    label: 'Grok write/STT/OCR/TTS/image/video',
    configPaths: [
      'defaults.llm.grok',
      'defaults.extract.stt.grokStt',
      'defaults.extract.ocr.grokOcr',
      'defaults.post.tts.grokTts',
      'defaults.post.image.grokImage',
      'defaults.post.video.grokVideo'
    ]
  },
  {
    envVar: 'GEMINI_API_KEY',
    label: 'Gemini write/STT/OCR/TTS/image/video/music',
    configPaths: [
      'defaults.llm.gemini',
      'defaults.extract.stt.geminiStt',
      'defaults.extract.ocr.geminiOcr',
      'defaults.post.tts.geminiTts',
      'defaults.post.image.geminiImage',
      'defaults.post.video.geminiVideo',
      'defaults.post.music.geminiMusic'
    ]
  },
  {
    envVar: 'GLM_API_KEY',
    label: 'GLM write/OCR/video',
    configPaths: [
      'defaults.llm.glm',
      'defaults.extract.ocr.glmOcr',
      'defaults.post.video.glmVideo'
    ]
  },
  {
    envVar: 'KIMI_API_KEY',
    label: 'Kimi write/OCR',
    configPaths: ['defaults.llm.kimi', 'defaults.extract.ocr.kimiOcr']
  },
  {
    envVar: 'CEREBRAS_API_KEY',
    label: 'Cerebras write',
    configPaths: ['defaults.llm.cerebras']
  },
  {
    envVar: 'RUNWAYML_API_SECRET',
    label: 'Runway video',
    configPaths: ['defaults.post.video.runwayVideo']
  },
  {
    envVar: 'LTXV_API_KEY',
    label: 'LTX video',
    configPaths: ['defaults.post.video.ltxVideo']
  },
  {
    envVar: 'MISTRAL_API_KEY',
    label: 'Mistral STT/OCR/TTS',
    configPaths: [
      'defaults.extract.stt.mistralStt',
      'defaults.extract.ocr.mistralOcr',
      'defaults.post.tts.mistralTts'
    ]
  },
  {
    envVar: 'BFL_API_KEY',
    label: 'BFL image',
    configPaths: ['defaults.post.image.bflImage']
  },
  {
    envVar: 'LUMA_AGENTS_API_KEY',
    label: 'Luma Labs image/video',
    configPaths: ['defaults.post.image.lumalabsImage', 'defaults.post.video.lumalabsVideo']
  },
  {
    envVar: 'FAL_API_KEY',
    label: 'fal.ai image/video/TTS/OCR',
    configPaths: [
      'defaults.post.image.falImage',
      'defaults.post.video.falVideo',
      'defaults.post.tts.falTts',
      'defaults.extract.ocr.falOcr'
    ]
  },
  {
    envVar: 'STABILITY_API_KEY',
    label: 'Stability AI sound effects',
    configPaths: []
  },
  {
    envVar: 'RECRAFT_API_TOKEN',
    label: 'Recraft image',
    configPaths: ['defaults.post.image.recraftImage']
  },
  {
    envVar: 'REPLICATE_API_TOKEN',
    label: 'Replicate OCR/image/video/TTS',
    configPaths: [
      'defaults.extract.ocr.replicateOcr',
      'defaults.post.image.replicateImage',
      'defaults.post.video.replicateVideo',
      'defaults.post.tts.replicateTts'
    ]
  },
  {
    envVar: 'ANTHROPIC_API_KEY',
    label: 'Anthropic write/OCR',
    configPaths: ['defaults.llm.anthropic', 'defaults.extract.ocr.anthropicOcr']
  },
  {
    envVar: 'GROQ_API_KEY',
    label: 'Groq write/STT/TTS',
    configPaths: [
      'defaults.llm.groq',
      'defaults.extract.stt.groqStt',
      'defaults.post.tts.groqTts'
    ]
  },
  {
    envVar: 'DEEPINFRA_API_KEY',
    label: 'DeepInfra STT/OCR/TTS',
    configPaths: [
      'defaults.extract.stt.deepinfraStt',
      'defaults.extract.ocr.deepinfraOcr',
      'defaults.post.tts.deepinfraTts'
    ]
  },
  {
    envVar: 'MINIMAX_API_KEY',
    label: 'MiniMax write/TTS/video/music',
    configPaths: [
      'defaults.llm.minimax',
      'defaults.post.tts.minimaxTts',
      'defaults.post.video.minimaxVideo',
      'defaults.post.music.minimaxMusic'
    ]
  },
  {
    envVar: 'ELEVENLABS_API_KEY',
    label: 'ElevenLabs TTS/music',
    configPaths: [
      'defaults.post.tts.elevenlabsTts',
      'defaults.post.music.elevenlabsMusic'
    ]
  },
  {
    envVar: 'ASSEMBLYAI_API_KEY',
    label: 'AssemblyAI STT',
    configPaths: ['defaults.extract.stt.assemblyaiStt']
  },
  {
    envVar: 'GLADIA_API_KEY',
    label: 'Gladia STT',
    configPaths: ['defaults.extract.stt.gladiaStt']
  },
  {
    envVar: 'DEEPGRAM_API_KEY',
    label: 'Deepgram STT/TTS',
    configPaths: ['defaults.extract.stt.deepgramStt', 'defaults.post.tts.deepgramTts']
  },
  {
    envVar: 'SPEECHIFY_API_KEY',
    label: 'Speechify TTS',
    configPaths: ['defaults.post.tts.speechifyTts']
  },
  {
    envVar: 'HUME_API_KEY',
    label: 'Hume TTS',
    configPaths: ['defaults.post.tts.humeTts']
  },
  {
    envVar: 'CARTESIA_API_KEY',
    label: 'Cartesia TTS',
    configPaths: ['defaults.post.tts.cartesiaTts']
  },
  {
    envVar: 'FISH_API_KEY',
    label: 'Fish Audio TTS',
    configPaths: ['defaults.post.tts.fishTts']
  },
  {
    envVar: 'INWORLD_API_KEY',
    label: 'Inworld AI TTS',
    configPaths: ['defaults.post.tts.inworldTts']
  },
  {
    envVar: 'SONIOX_API_KEY',
    label: 'Soniox STT',
    configPaths: ['defaults.extract.stt.sonioxStt']
  },
  {
    envVar: 'SPEECHMATICS_API_KEY',
    label: 'Speechmatics STT',
    configPaths: ['defaults.extract.stt.speechmaticsStt']
  },
  {
    envVar: 'REVAI_ACCESS_TOKEN',
    label: 'Rev STT',
    configPaths: ['defaults.extract.stt.revStt']
  },
  {
    envVar: 'TOGETHER_API_KEY',
    label: 'Together write/STT',
    configPaths: ['defaults.llm.together', 'defaults.extract.stt.togetherStt']
  },
  {
    envVar: 'HAPPYSCRIBE_API_KEY',
    label: 'Happy Scribe STT',
    configPaths: ['defaults.extract.stt.happyscribeStt']
  },
  {
    envVar: 'SUPADATA_API_KEY',
    label: 'Supadata STT/URL',
    configPaths: ['defaults.extract.stt.supadataStt']
  },
  {
    envVar: 'SCRAPECREATORS_API_KEY',
    label: 'ScrapeCreators STT',
    configPaths: ['defaults.extract.stt.scrapecreatorsStt']
  },
  {
    envVar: 'FIRECRAWL_API_KEY',
    label: 'Firecrawl URL',
    configPaths: []
  },
  {
    envVar: 'SPIDER_API_KEY',
    label: 'Spider URL',
    configPaths: []
  },
  {
    envVar: 'ZYTE_API_KEY',
    label: 'Zyte URL',
    configPaths: []
  },
  {
    envVar: 'X_BEARER_TOKEN',
    label: 'X Spaces metadata and download lookup',
    configPaths: []
  },
  {
    envVar: 'HUGGINGFACE_TOKEN',
    label: 'Hugging Face Reverb assets',
    configPaths: ['defaults.extract.stt.reverb']
  }
] as const satisfies readonly HostedProviderEnvCheck[]

// Focused setup steps used to carry their own literal env-key lists, which drifted
// as providers were added and removed. Derive them from the config paths the
// master list already records, so a new provider only has to be registered once.
// Setup provider-coverage contracts pin each derived set to its selector registry.
export const getHostedProviderEnvKeysForConfigPrefix = (
  configPathPrefix: string
): string[] => [...new Set(
  HOSTED_PROVIDER_ENV_CHECKS
    .filter(check => check.configPaths.some(path => path.startsWith(configPathPrefix)))
    .map(check => check.envVar)
)]

export const findHostedProviderEnvKeyForConfigPath = (
  configPath: string
): string | undefined =>
  HOSTED_PROVIDER_ENV_CHECKS.find(check => (check.configPaths as readonly string[]).includes(configPath))?.envVar

const configuredEnv = (env: Record<string, string | undefined>, envVar: string): boolean => {
  const value = env[envVar]
  return typeof value === 'string' && value.trim().length > 0
}

const getConfigPathValue = (config: AutoshowConfig | undefined, path: string): unknown => {
  if (!config) return undefined
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[segment]
  }, config)
}

const isConfiguredValue = (value: unknown): boolean => {
  if (value === true) return true
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return false
}

export const getHostedProviderConfiguredPaths = (
  config: AutoshowConfig | undefined,
  paths: readonly string[]
): string[] => paths.filter(path => isConfiguredValue(getConfigPathValue(config, path)))

const resolveHostedProviderChecks = (
  envVars?: readonly string[]
): HostedProviderEnvCheck[] => {
  if (!envVars) {
    return [...HOSTED_PROVIDER_ENV_CHECKS]
  }
  const selected = new Set(envVars)
  const resolved = HOSTED_PROVIDER_ENV_CHECKS.filter(check => selected.has(check.envVar))

  // A per-step subset that names a variable the master list does not carry used
  // to be filtered away silently, so the step under-reported its own providers.
  if (resolved.length !== selected.size) {
    const known = new Set<string>(HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar))
    const unknown = [...selected].filter(envVar => !known.has(envVar))
    throw InternalError(
      `Unknown hosted provider env vars requested: ${unknown.join(', ')}. Add them to HOSTED_PROVIDER_ENV_CHECKS or remove them from the step subset.`,
      { stage: 'setup:hosted-providers' }
    )
  }

  return resolved
}

export const buildHostedProviderConfigurationRows = (
  env: Record<string, string | undefined>,
  options: {
    envVars?: readonly string[]
    config?: AutoshowConfig | undefined
  } = {}
): HostedProviderConfigurationRow[] =>
  resolveHostedProviderChecks(options.envVars).map((provider) => {
    const status: HostedProviderStatus = configuredEnv(env, provider.envVar) ? 'configured' : 'missing'
    const configuredPaths = getHostedProviderConfiguredPaths(options.config, provider.configPaths)
    const detail = status === 'configured'
      ? 'set'
      : configuredPaths.length > 0
        ? `not set; configured in ${configuredPaths.join(', ')}`
        : `set ${provider.envVar} to enable`

    return {
      provider: provider.label,
      status,
      envKey: provider.envVar,
      detail
    }
  })

export const summarizeHostedProviderRows = (
  rows: readonly HostedProviderConfigurationRow[]
): HostedProviderConfigurationSummary => {
  const configured = rows.filter(row => row.status === 'configured').length
  return {
    configured,
    missing: rows.length - configured,
    total: rows.length
  }
}

export const buildHostedProviderConfigurationTable = (
  rows: readonly HostedProviderConfigurationRow[]
): HumanLogTable =>
  createHumanTable(rows, ['provider', 'status', 'envKey', 'detail'])

// "present" rather than "configured": this check only proves the variable is
// non-empty. A revoked, truncated, or typo'd key still counts, and the
// surrounding rows report functional readiness, which invites over-reading.
export const buildHostedProviderConfigurationSummaryTable = (
  summary: HostedProviderConfigurationSummary
): HumanLogTable =>
  createHumanTable([{
    present: `${summary.configured}/${summary.total}`,
    missing: summary.missing,
    detail: summary.missing === 0 ? 'all env vars set (presence only, not validated)' : `${summary.missing} missing`
  }], ['present', 'missing', 'detail'])

export const buildHostedProviderConfigurationLogTable = (
  rows: readonly HostedProviderConfigurationRow[],
  options: {
    mode?: HostedProviderConfigurationLogMode | undefined
  } = {}
): HumanLogTable => {
  const mode = options.mode ?? 'all'
  if (mode === 'all') {
    return buildHostedProviderConfigurationTable(rows)
  }

  const summary = summarizeHostedProviderRows(rows)
  if (summary.missing === 0) {
    return buildHostedProviderConfigurationSummaryTable(summary)
  }

  const table = buildHostedProviderConfigurationTable(rows.filter(row => row.status === 'missing'))
  return {
    ...table,
    details: [
      ...(table.details ?? []),
      { label: 'configured', value: `${summary.configured}/${summary.total}` }
    ]
  }
}

export const logHostedProviderConfiguration = (
  logger: TableLogger,
  options: {
    env?: Record<string, string | undefined>
    envVars?: readonly string[]
    config?: AutoshowConfig | undefined
    title?: string
    mode?: HostedProviderConfigurationLogMode
  } = {}
): HostedProviderConfigurationSummary => {
  const rows = buildHostedProviderConfigurationRows(options.env ?? process.env as Record<string, string | undefined>, {
    ...(options.envVars ? { envVars: options.envVars } : {}),
    ...(options.config ? { config: options.config } : {})
  })
  const summary = summarizeHostedProviderRows(rows)

  logger.write('info', options.title ?? 'Hosted Provider Configuration', {
    category: 'command',
    humanTable: buildHostedProviderConfigurationLogTable(
      rows,
      options.mode === undefined ? {} : { mode: options.mode }
    ),
    metadata: {
      configured: summary.configured,
      missing: summary.missing,
      total: summary.total,
      mode: options.mode ?? 'all',
      providers: rows
    }
  })

  return summary
}
