import type { AutoshowConfig, HostedProviderConfigurationLogMode, HostedProviderConfigurationRow, HostedProviderConfigurationSummary, HostedProviderEnvCheck, HostedProviderStatus } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InternalError } from '~/utils/error-handler'

export const HOSTED_PROVIDER_ENV_CHECKS = [
  {
    providerId: 'openai',
    envVar: 'OPENAI_API_KEY',
    label: 'OpenAI write/OCR/TTS/image',
    hintUrl: 'https://platform.openai.com/api-keys',
    stages: ['write', 'ocr', 'tts', 'image'],
    ttsPreflight: { provider: 'openai', label: 'OpenAI TTS' },
    configPaths: [
      'defaults.llm.openai',
      'defaults.extract.ocr.openaiOcr',
      'defaults.tts.openaiTts',
      'defaults.image.openaiImage'
    ]
  },
  {
    providerId: 'grok',
    envVar: 'XAI_API_KEY',
    label: 'Grok write/STT/OCR/TTS/image/video',
    hintUrl: 'https://console.x.ai/',
    stages: ['write', 'stt', 'ocr', 'tts', 'image', 'video', 'voice'],
    ttsPreflight: { provider: 'grok', label: 'Grok TTS' },
    configPaths: [
      'defaults.llm.grok',
      'defaults.extract.stt.grokStt',
      'defaults.extract.ocr.grokOcr',
      'defaults.tts.grokTts',
      'defaults.image.grokImage',
      'defaults.video.grokVideo'
    ]
  },
  {
    providerId: 'gemini',
    envVar: 'GEMINI_API_KEY',
    label: 'Gemini write/STT/OCR/image/video/music',
    hintUrl: 'https://aistudio.google.com/apikey',
    stages: ['write', 'stt', 'ocr', 'image', 'video', 'music'],
    configPaths: [
      'defaults.llm.gemini',
      'defaults.extract.stt.geminiStt',
      'defaults.extract.ocr.geminiOcr',
      'defaults.image.geminiImage',
      'defaults.video.geminiVideo',
      'defaults.music.geminiMusic'
    ]
  },
  {
    providerId: 'glm',
    envVar: 'GLM_API_KEY',
    label: 'GLM write/OCR',
    hintUrl: 'https://docs.z.ai/',
    stages: ['write', 'ocr'],
    configPaths: [
      'defaults.llm.glm',
      'defaults.extract.ocr.glmOcr'
    ]
  },
  {
    providerId: 'kimi',
    envVar: 'KIMI_API_KEY',
    label: 'Kimi write/OCR',
    hintUrl: 'https://platform.moonshot.ai/',
    stages: ['write', 'ocr'],
    configPaths: ['defaults.llm.kimi', 'defaults.extract.ocr.kimiOcr']
  },
  {
    providerId: 'cerebras',
    envVar: 'CEREBRAS_API_KEY',
    label: 'Cerebras write',
    hintUrl: 'https://cloud.cerebras.ai/',
    stages: ['write'],
    configPaths: ['defaults.llm.cerebras']
  },
  {
    providerId: 'ltx',
    envVar: 'LTXV_API_KEY',
    label: 'LTX video',
    hintUrl: 'https://docs.ltx.video/',
    stages: ['video'],
    configPaths: ['defaults.video.ltxVideo']
  },
  {
    providerId: 'mistral',
    envVar: 'MISTRAL_API_KEY',
    label: 'Mistral STT/OCR/TTS',
    hintUrl: 'https://console.mistral.ai/api-keys',
    stages: ['stt', 'ocr', 'tts', 'voice'],
    ttsPreflight: { provider: 'mistral', label: 'Mistral TTS' },
    configPaths: [
      'defaults.extract.stt.mistralStt',
      'defaults.extract.ocr.mistralOcr',
      'defaults.tts.mistralTts'
    ]
  },
  {
    providerId: 'bfl',
    envVar: 'BFL_API_KEY',
    label: 'BFL image',
    hintUrl: 'https://dashboard.bfl.ai/',
    stages: ['image'],
    configPaths: ['defaults.image.bflImage']
  },
  {
    providerId: 'lumalabs',
    envVar: 'LUMA_AGENTS_API_KEY',
    label: 'Luma Labs image/video',
    hintUrl: 'https://platform.lumalabs.ai/',
    stages: ['image', 'video'],
    configPaths: ['defaults.image.lumalabsImage', 'defaults.video.lumalabsVideo']
  },
  {
    providerId: 'fal',
    envVar: 'FAL_API_KEY',
    label: 'fal.ai image/video',
    hintUrl: 'https://fal.ai/dashboard/keys',
    stages: ['image', 'video'],
    configPaths: [
      'defaults.image.falImage',
      'defaults.video.falVideo'
    ]
  },
  {
    providerId: 'stability',
    envVar: 'STABILITY_API_KEY',
    label: 'Stability AI sound effects',
    hintUrl: 'https://platform.stability.ai/account/keys',
    stages: ['soundscape'],
    configPaths: []
  },
  {
    providerId: 'replicate',
    envVar: 'REPLICATE_API_TOKEN',
    label: 'Replicate image/video',
    hintUrl: 'https://replicate.com/',
    stages: ['image', 'video', 'soundscape'],
    configPaths: [
      'defaults.image.replicateImage',
      'defaults.video.replicateVideo'
    ]
  },
  {
    providerId: 'anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    label: 'Anthropic write/OCR',
    hintUrl: 'https://console.anthropic.com/settings/keys',
    stages: ['write', 'ocr'],
    configPaths: ['defaults.llm.anthropic', 'defaults.extract.ocr.anthropicOcr']
  },
  {
    providerId: 'groq',
    envVar: 'GROQ_API_KEY',
    label: 'Groq write/STT',
    hintUrl: 'https://console.groq.com/keys',
    stages: ['write', 'stt'],
    configPaths: [
      'defaults.llm.groq',
      'defaults.extract.stt.groqStt'
    ]
  },
  {
    providerId: 'deepinfra',
    envVar: 'DEEPINFRA_API_KEY',
    label: 'DeepInfra STT/OCR',
    hintUrl: 'https://deepinfra.com/',
    stages: ['stt', 'ocr'],
    configPaths: [
      'defaults.extract.stt.deepinfraStt',
      'defaults.extract.ocr.deepinfraOcr'
    ]
  },
  {
    providerId: 'minimax',
    envVar: 'MINIMAX_API_KEY',
    label: 'MiniMax write/video/music',
    hintUrl: 'https://platform.minimax.io/',
    stages: ['write', 'video', 'music'],
    configPaths: [
      'defaults.llm.minimax',
      'defaults.music.minimaxMusic'
    ]
  },
  {
    providerId: 'elevenlabs',
    envVar: 'ELEVENLABS_API_KEY',
    label: 'ElevenLabs TTS/music',
    hintUrl: 'https://elevenlabs.io/',
    stages: ['tts', 'music', 'soundscape', 'voice'],
    ttsPreflight: { provider: 'elevenlabs', label: 'ElevenLabs TTS' },
    liveProbe: 'voice-catalog',
    configPaths: [
      'defaults.tts.elevenlabsTts',
      'defaults.music.elevenlabsMusic'
    ]
  },
  {
    providerId: 'assemblyai',
    envVar: 'ASSEMBLYAI_API_KEY',
    label: 'AssemblyAI STT',
    hintUrl: 'https://www.assemblyai.com/dashboard/signup',
    stages: ['stt'],
    configPaths: ['defaults.extract.stt.assemblyaiStt']
  },
  {
    providerId: 'gladia',
    envVar: 'GLADIA_API_KEY',
    label: 'Gladia STT',
    hintUrl: 'https://app.gladia.io/apikeys',
    stages: ['stt'],
    configPaths: ['defaults.extract.stt.gladiaStt']
  },
  {
    providerId: 'deepgram',
    envVar: 'DEEPGRAM_API_KEY',
    label: 'Deepgram STT',
    hintUrl: 'https://console.deepgram.com/project/api-keys',
    stages: ['stt'],
    configPaths: ['defaults.extract.stt.deepgramStt']
  },
  {
    providerId: 'speechify',
    envVar: 'SPEECHIFY_API_KEY',
    label: 'Speechify TTS',
    hintUrl: 'https://console.speechify.com/',
    stages: ['tts', 'voice'],
    ttsPreflight: { provider: 'speechify', label: 'Speechify TTS' },
    liveProbe: 'voice-catalog',
    configPaths: ['defaults.tts.speechifyTts']
  },
  {
    providerId: 'hume',
    envVar: 'HUME_API_KEY',
    label: 'Hume TTS',
    hintUrl: 'https://platform.hume.ai/',
    stages: ['tts', 'voice'],
    ttsPreflight: { provider: 'hume', label: 'Hume TTS' },
    liveProbe: 'voice-catalog',
    configPaths: ['defaults.tts.humeTts']
  },
  {
    providerId: 'cartesia',
    envVar: 'CARTESIA_API_KEY',
    label: 'Cartesia TTS',
    hintUrl: 'https://play.cartesia.ai/',
    stages: ['tts', 'voice'],
    ttsPreflight: { provider: 'cartesia', label: 'Cartesia TTS' },
    liveProbe: 'voice-catalog',
    configPaths: ['defaults.tts.cartesiaTts']
  },
  {
    providerId: 'inworld',
    envVar: 'INWORLD_API_KEY',
    label: 'Inworld AI TTS',
    hintUrl: 'https://inworld.ai/',
    stages: ['tts', 'voice'],
    ttsPreflight: { provider: 'inworld', label: 'Inworld AI TTS' },
    liveProbe: 'voice-catalog',
    configPaths: ['defaults.tts.inworldTts']
  },
  {
    providerId: 'soniox',
    envVar: 'SONIOX_API_KEY',
    label: 'Soniox STT',
    hintUrl: 'https://console.soniox.com',
    stages: ['stt'],
    configPaths: ['defaults.extract.stt.sonioxStt']
  },
  {
    providerId: 'speechmatics',
    envVar: 'SPEECHMATICS_API_KEY',
    label: 'Speechmatics STT',
    hintUrl: 'https://portal.speechmatics.com',
    stages: ['stt'],
    configPaths: ['defaults.extract.stt.speechmaticsStt']
  },
  {
    providerId: 'together',
    envVar: 'TOGETHER_API_KEY',
    label: 'Together write/STT',
    hintUrl: 'https://api.together.ai/',
    stages: ['write', 'stt'],
    configPaths: ['defaults.llm.together', 'defaults.extract.stt.togetherStt']
  },
  {
    providerId: 'happyscribe',
    envVar: 'HAPPYSCRIBE_API_KEY',
    label: 'Happy Scribe STT',
    hintUrl: 'https://www.happyscribe.com/',
    stages: ['stt'],
    configPaths: ['defaults.extract.stt.happyscribeStt']
  },
  {
    providerId: 'supadata',
    envVar: 'SUPADATA_API_KEY',
    label: 'Supadata STT/URL',
    hintUrl: 'https://supadata.ai/',
    stages: ['stt', 'url'],
    configPaths: ['defaults.extract.stt.supadataStt']
  },
  {
    providerId: 'scrapecreators',
    envVar: 'SCRAPECREATORS_API_KEY',
    label: 'ScrapeCreators STT',
    hintUrl: 'https://scrapecreators.com/',
    stages: ['stt'],
    configPaths: ['defaults.extract.stt.scrapecreatorsStt']
  },
  {
    providerId: 'firecrawl',
    envVar: 'FIRECRAWL_API_KEY',
    label: 'Firecrawl URL',
    hintUrl: 'https://www.firecrawl.dev/',
    stages: ['url'],
    configPaths: []
  },
  {
    providerId: 'spider',
    envVar: 'SPIDER_API_KEY',
    label: 'Spider URL',
    hintUrl: 'https://spider.cloud/',
    stages: ['url'],
    configPaths: []
  },
  {
    providerId: 'zyte',
    envVar: 'ZYTE_API_KEY',
    label: 'Zyte URL',
    hintUrl: 'https://www.zyte.com/',
    stages: ['url'],
    configPaths: []
  },
  {
    providerId: 'x-spaces',
    envVar: 'X_BEARER_TOKEN',
    label: 'X Spaces metadata and download lookup',
    hintUrl: 'https://developer.x.com/en/portal/dashboard',
    stages: ['metadata', 'download'],
    configPaths: []
  }
] as const satisfies readonly HostedProviderEnvCheck[]

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

export const findHostedProviderCredential = (
  providerId: string
): HostedProviderEnvCheck | undefined =>
  HOSTED_PROVIDER_ENV_CHECKS.find(check => check.providerId === providerId)

export const findHostedProviderCredentialByEnvVar = (
  envVar: string
): HostedProviderEnvCheck | undefined =>
  HOSTED_PROVIDER_ENV_CHECKS.find(check => check.envVar === envVar)

export const findHostedTtsCredential = (
  provider: import('~/types').TtsProvider
): HostedProviderEnvCheck | undefined =>
  (HOSTED_PROVIDER_ENV_CHECKS as readonly HostedProviderEnvCheck[])
    .find(check => check.ttsPreflight?.provider === provider)

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

export const getMissingConfiguredHostedProviderCredentials = (
  env: Record<string, string | undefined>,
  config: AutoshowConfig | undefined
): HostedProviderEnvCheck[] =>
  (HOSTED_PROVIDER_ENV_CHECKS as readonly HostedProviderEnvCheck[]).filter(provider =>
    getHostedProviderConfiguredPaths(config, provider.configPaths).length > 0
    && !configuredEnv(env, provider.envVar)
  )

const resolveHostedProviderChecks = (
  envVars?: readonly string[]
): HostedProviderEnvCheck[] => {
  if (!envVars) {
    return [...HOSTED_PROVIDER_ENV_CHECKS]
  }
  const selected = new Set(envVars)
  const resolved = HOSTED_PROVIDER_ENV_CHECKS.filter(check => selected.has(check.envVar))

  if (resolved.length !== selected.size) {
    const known = new Set<string>(HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar))
    const unknown = [...selected].filter(envVar => !known.has(envVar))
    throw InternalError(
      `Unknown hosted provider env vars requested: ${unknown.join(', ')}. Add them to HOSTED_PROVIDER_ENV_CHECKS or remove them from the step subset.`,
      { stage: 'setup:hosted-providers', retryable: false }
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

export const logHostedProviderConfiguration = (
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
  const providers = options.mode === 'missing' ? rows.filter(row => row.status === 'missing') : rows

  l.write(summary.missing > 0 ? 'warn' : 'info', `${options.title ?? 'Hosted provider configuration'}: ${summary.configured}/${summary.total} configured`, {
    category: 'command',
    metadata: {
      configured: summary.configured,
      missing: summary.missing,
      total: summary.total,
      mode: options.mode ?? 'all',
      providers
    }
  })

  return summary
}
