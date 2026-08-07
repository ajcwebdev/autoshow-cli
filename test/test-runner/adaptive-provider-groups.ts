import type { AdaptiveProviderFlagValue, AdaptiveProviderGroup, AdaptiveProviderGroupKind } from '~/types'

const STT_REMOTE_PROVIDERS = [
  'deepinfra',
  'deepgram',
  'soniox',
  'speechmatics',
  'rev',
  'groq',
  'grok',
  'mistral',
  'assemblyai',
  'gladia',
  'happyscribe',
  'supadata',
  'scrapecreators',
  'gemini',
  'together',
] as const

const OCR_REMOTE_PROVIDERS = [
  'mistral',
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra',
] as const

const URL_REMOTE_PROVIDERS = [
  'firecrawl',
  'glm-reader',
  'spider',
  'supadata',
  'zyte',
] as const

const LLM_REMOTE_PROVIDERS = [
  'openai',
  'groq',
  'gemini',
  'anthropic',
  'minimax',
  'grok',
  'glm',
  'kimi',
  'together',
  'cerebras',
] as const

const TTS_REMOTE_PROVIDERS = [
  'elevenlabs',
  'minimax',
  'groq',
  'grok',
  'mistral',
  'openai',
  'gemini',
  'deepgram',
  'speechify',
  'hume',
  'cartesia',
] as const

const IMAGE_REMOTE_PROVIDERS = [
  'gemini',
  'openai',
  'grok',
  'bfl',
  'recraft',
] as const

const VIDEO_REMOTE_PROVIDERS = [
  'gemini',
  'minimax',
  'glm',
  'grok',
  'runway',
  'ltx',
  'replicate',
] as const

const MUSIC_REMOTE_PROVIDERS = [
  'elevenlabs',
  'minimax',
  'gemini',
] as const

const STT_REMOTE_SET = new Set<string>(STT_REMOTE_PROVIDERS)
const OCR_REMOTE_SET = new Set<string>(OCR_REMOTE_PROVIDERS)
const URL_REMOTE_SET = new Set<string>(URL_REMOTE_PROVIDERS)
const LLM_REMOTE_SET = new Set<string>(LLM_REMOTE_PROVIDERS)
const TTS_REMOTE_SET = new Set<string>(TTS_REMOTE_PROVIDERS)
const IMAGE_REMOTE_SET = new Set<string>(IMAGE_REMOTE_PROVIDERS)
const VIDEO_REMOTE_SET = new Set<string>(VIDEO_REMOTE_PROVIDERS)
const MUSIC_REMOTE_SET = new Set<string>(MUSIC_REMOTE_PROVIDERS)

const VALUE_FLAGS = new Set([
  'provider',
  'url-provider',
  'stt',
  'ocr',
  'llm',
  'tts',
  'image',
  'video',
  'music',
  'all-providers',
  'openai',
  'groq',
  'gemini',
  'anthropic',
  'minimax',
  'grok',
  'glm',
  'kimi',
  'together',
  'cerebras',
  'llama',
  'whisper',
  'reverb',
  'deepinfra',
  'deepgram-stt',
  'soniox-stt',
  'speechmatics-stt',
  'rev-stt',
  'groq-stt',
  'grok-stt',
  'mistral-stt',
  'assemblyai-stt',
  'gladia-stt',
  'happyscribe-stt',
  'supadata-stt',
  'scrapecreators-stt',
  'gemini-stt',
  'together-stt',
  'mistral-ocr',
  'glm-ocr',
  'kimi-ocr',
  'openai-ocr',
  'grok-ocr',
  'anthropic-ocr',
  'gemini-ocr',
  'deepinfra-ocr',
  'kitten-tts',
  'elevenlabs-tts',
  'minimax-tts',
  'groq-tts',
  'grok-tts',
  'mistral-tts',
  'openai-tts',
  'gemini-tts',
  'deepgram-tts',
  'speechify-tts',
  'hume-tts',
  'cartesia-tts',
  'gemini-image',
  'openai-image',
  'grok-image',
  'bfl-image',
  'recraft-image',
  'gemini-video',
  'minimax-video',
  'glm-video',
  'grok-video',
  'runway-video',
  'ltx-video',
  'replicate-video',
  'elevenlabs-music',
  'minimax-music',
  'gemini-music',
])

const TTS_SELECTOR_FLAGS: Record<string, string> = {
  'kitten-tts': 'kitten',
  'elevenlabs-tts': 'elevenlabs',
  'minimax-tts': 'minimax',
  'groq-tts': 'groq',
  'grok-tts': 'grok',
  'mistral-tts': 'mistral',
  'openai-tts': 'openai',
  'gemini-tts': 'gemini',
  'deepgram-tts': 'deepgram',
  'speechify-tts': 'speechify',
  'hume-tts': 'hume',
  'cartesia-tts': 'cartesia',
}

const IMAGE_SELECTOR_FLAGS: Record<string, string> = {
  'gemini-image': 'gemini',
  'openai-image': 'openai',
  'grok-image': 'grok',
  'bfl-image': 'bfl',
  'recraft-image': 'recraft',
}

const VIDEO_SELECTOR_FLAGS: Record<string, string> = {
  'gemini-video': 'gemini',
  'minimax-video': 'minimax',
  'glm-video': 'glm',
  'grok-video': 'grok',
  'runway-video': 'runway',
  'ltx-video': 'ltx',
  'replicate-video': 'replicate',
}

const MUSIC_SELECTOR_FLAGS: Record<string, string> = {
  'elevenlabs-music': 'elevenlabs',
  'minimax-music': 'minimax',
  'gemini-music': 'gemini',
}

const STT_SELECTOR_FLAGS: Record<string, string> = {
  'deepgram-stt': 'deepgram',
  'soniox-stt': 'soniox',
  'speechmatics-stt': 'speechmatics',
  'rev-stt': 'rev',
  'groq-stt': 'groq',
  'grok-stt': 'grok',
  'mistral-stt': 'mistral',
  'assemblyai-stt': 'assemblyai',
  'gladia-stt': 'gladia',
  'happyscribe-stt': 'happyscribe',
  'supadata-stt': 'supadata',
  'scrapecreators-stt': 'scrapecreators',
  'gemini-stt': 'gemini',
  'together-stt': 'together',
}

const OCR_SELECTOR_FLAGS: Record<string, string> = {
  'mistral-ocr': 'mistral',
  'glm-ocr': 'glm',
  'kimi-ocr': 'kimi',
  'openai-ocr': 'openai',
  'grok-ocr': 'grok',
  'anthropic-ocr': 'anthropic',
  'gemini-ocr': 'gemini',
  'deepinfra-ocr': 'deepinfra',
}

const WRITE_LLM_SELECTOR_FLAGS: Record<string, string> = {
  openai: 'openai',
  groq: 'groq',
  gemini: 'gemini',
  anthropic: 'anthropic',
  minimax: 'minimax',
  grok: 'grok',
  glm: 'glm',
  kimi: 'kimi',
  together: 'together',
  cerebras: 'cerebras',
}

const MEDIA_EXTENSIONS = new Set([
  'aac',
  'aiff',
  'avi',
  'flac',
  'm4a',
  'mkv',
  'mov',
  'mp3',
  'mp4',
  'mpeg',
  'mpg',
  'ogg',
  'opus',
  'wav',
  'webm',
])

const DOCUMENT_EXTENSIONS = new Set([
  'bmp',
  'cbz',
  'epub',
  'gif',
  'heic',
  'htm',
  'html',
  'jpeg',
  'jpg',
  'md',
  'pdf',
  'png',
  'tif',
  'tiff',
  'txt',
  'webp',
])

const extractFlagName = (arg: string): string | null => {
  if (!arg.startsWith('--')) {
    return null
  }
  const raw = arg.slice(2)
  const equalsIndex = raw.indexOf('=')
  return (equalsIndex === -1 ? raw : raw.slice(0, equalsIndex)).trim()
}

const collectFlagValues = (args: string[]): AdaptiveProviderFlagValue[] => {
  const values: AdaptiveProviderFlagValue[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg?.startsWith('--')) {
      continue
    }

    const raw = arg.slice(2)
    const equalsIndex = raw.indexOf('=')
    const flag = (equalsIndex === -1 ? raw : raw.slice(0, equalsIndex)).trim()
    if (!flag) {
      continue
    }

    if (equalsIndex !== -1) {
      values.push({ flag, value: raw.slice(equalsIndex + 1) })
      continue
    }

    const next = args[index + 1]
    if (VALUE_FLAGS.has(flag) && typeof next === 'string' && !next.startsWith('--')) {
      values.push({ flag, value: next })
      index += 1
    } else {
      values.push({ flag, value: null })
    }
  }

  return values
}

const firstPositionalAfterCommand = (args: string[]): string | null => {
  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index]
    if (typeof arg !== 'string') {
      continue
    }

    const flag = extractFlagName(arg)
    if (flag) {
      if (!arg.includes('=') && VALUE_FLAGS.has(flag) && typeof args[index + 1] === 'string' && !args[index + 1]?.startsWith('--')) {
        index += 1
      }
      continue
    }

    return arg
  }

  return null
}

export const parseProviderName = (token: string | null | undefined): string | null => {
  const trimmed = token?.trim()
  if (!trimmed) {
    return null
  }

  const separatorIndex = trimmed.search(/[=:]/)
  const provider = (separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex))
    .trim()
    .toLowerCase()

  if (!provider) {
    return null
  }

  if (provider === 'llama.cpp') {
    return 'llama'
  }

  return provider
}

const getInputExtension = (input: string | null): string | null => {
  const clean = input?.split(/[?#]/, 1)[0]?.toLowerCase()
  const match = clean?.match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? null
}

const inferExtractKind = (input: string | null, provider: string): 'transcribe' | 'extract' | 'ambiguous' => {
  const extension = getInputExtension(input)
  if (extension && MEDIA_EXTENSIONS.has(extension)) {
    return 'transcribe'
  }
  if (extension && DOCUMENT_EXTENSIONS.has(extension)) {
    return 'extract'
  }
  if (provider.includes('stt') || provider === 'whisper' || provider === 'reverb') {
    return 'transcribe'
  }
  if (provider.includes('ocr') || provider === 'tesseract') {
    return 'extract'
  }
  if (STT_REMOTE_SET.has(provider) && !OCR_REMOTE_SET.has(provider)) {
    return 'transcribe'
  }
  if (OCR_REMOTE_SET.has(provider) && !STT_REMOTE_SET.has(provider)) {
    return 'extract'
  }
  return 'ambiguous'
}

const addGroup = (
  groups: Set<AdaptiveProviderGroup>,
  kind: AdaptiveProviderGroupKind,
  provider: string | null,
  remoteProviders: Set<string>
): void => {
  if (!provider || !remoteProviders.has(provider)) {
    return
  }

  groups.add(`${kind}/${provider}` as AdaptiveProviderGroup)
}

const addAllGroups = (
  groups: Set<AdaptiveProviderGroup>,
  kind: AdaptiveProviderGroupKind,
  providers: readonly string[]
): void => {
  for (const provider of providers) {
    groups.add(`${kind}/${provider}` as AdaptiveProviderGroup)
  }
}

const addExtractProviderGroup = (
  groups: Set<AdaptiveProviderGroup>,
  input: string | null,
  provider: string | null
): void => {
  if (!provider) {
    return
  }

  const kind = inferExtractKind(input, provider)
  if (kind === 'transcribe') {
    addGroup(groups, 'transcribe', provider, STT_REMOTE_SET)
    return
  }
  if (kind === 'extract') {
    addGroup(groups, 'extract', provider, OCR_REMOTE_SET)
    return
  }

  addGroup(groups, 'transcribe', provider, STT_REMOTE_SET)
  addGroup(groups, 'extract', provider, OCR_REMOTE_SET)
}

const addAllExtractGroups = (groups: Set<AdaptiveProviderGroup>, input: string | null): void => {
  const extension = getInputExtension(input)
  if (extension && MEDIA_EXTENSIONS.has(extension)) {
    addAllGroups(groups, 'transcribe', STT_REMOTE_PROVIDERS)
    return
  }
  if (input && /^https?:\/\//i.test(input) && !extension) {
    addAllGroups(groups, 'url', URL_REMOTE_PROVIDERS)
    return
  }
  addAllGroups(groups, 'extract', OCR_REMOTE_PROVIDERS)
}

const addWriteAllProviderGroups = (
  groups: Set<AdaptiveProviderGroup>,
  value: string | null
): void => {
  switch (value) {
    case 'stt':
      addAllGroups(groups, 'transcribe', STT_REMOTE_PROVIDERS)
      break
    case 'ocr':
      addAllGroups(groups, 'extract', OCR_REMOTE_PROVIDERS)
      break
    case 'url':
      addAllGroups(groups, 'url', URL_REMOTE_PROVIDERS)
      break
    case 'llm':
      addAllGroups(groups, 'write', LLM_REMOTE_PROVIDERS)
      break
    case 'tts':
      addAllGroups(groups, 'tts', TTS_REMOTE_PROVIDERS)
      break
    case 'image':
      addAllGroups(groups, 'image', IMAGE_REMOTE_PROVIDERS)
      break
    case 'video':
      addAllGroups(groups, 'video', VIDEO_REMOTE_PROVIDERS)
      break
    case 'music':
      addAllGroups(groups, 'music', MUSIC_REMOTE_PROVIDERS)
      break
  }
}

const normalizedStepValue = (value: string | null): string | null => {
  const provider = parseProviderName(value)
  if (!provider) {
    return null
  }
  return provider
}

export const extractAdaptiveProviderGroups = (args: string[]): AdaptiveProviderGroup[] => {
  if (args[0] !== 'src/cli/create-cli.ts') {
    return []
  }

  const command = args[1]
  const groups = new Set<AdaptiveProviderGroup>()
  const flagValues = collectFlagValues(args)
  const input = firstPositionalAfterCommand(args)

  if (command === 'extract') {
    for (const { flag, value } of flagValues) {
      if (flag === 'provider') {
        addExtractProviderGroup(groups, input, parseProviderName(value))
      } else if (flag === 'url-provider') {
        addGroup(groups, 'url', parseProviderName(value), URL_REMOTE_SET)
      } else if (flag === 'all-providers') {
        addAllExtractGroups(groups, input)
      }
    }
  } else if (command === 'write') {
    for (const { flag, value } of flagValues) {
      const provider = normalizedStepValue(value)
      if (flag === 'stt') {
        addGroup(groups, 'transcribe', provider, STT_REMOTE_SET)
      } else if (flag === 'ocr') {
        addGroup(groups, 'extract', provider, OCR_REMOTE_SET)
      } else if (flag === 'url-provider') {
        addGroup(groups, 'url', provider, URL_REMOTE_SET)
      } else if (flag === 'llm') {
        addGroup(groups, 'write', provider, LLM_REMOTE_SET)
      } else if (flag === 'tts') {
        addGroup(groups, 'tts', provider, TTS_REMOTE_SET)
      } else if (flag === 'image') {
        addGroup(groups, 'image', provider, IMAGE_REMOTE_SET)
      } else if (flag === 'video') {
        addGroup(groups, 'video', provider, VIDEO_REMOTE_SET)
      } else if (flag === 'music') {
        addGroup(groups, 'music', provider, MUSIC_REMOTE_SET)
      } else if (flag === 'all-providers') {
        addWriteAllProviderGroups(groups, value?.trim().toLowerCase() ?? null)
      } else if (WRITE_LLM_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'write', WRITE_LLM_SELECTOR_FLAGS[flag] ?? null, LLM_REMOTE_SET)
      } else if (TTS_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'tts', TTS_SELECTOR_FLAGS[flag] ?? null, TTS_REMOTE_SET)
      } else if (IMAGE_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'image', IMAGE_SELECTOR_FLAGS[flag] ?? null, IMAGE_REMOTE_SET)
      } else if (VIDEO_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'video', VIDEO_SELECTOR_FLAGS[flag] ?? null, VIDEO_REMOTE_SET)
      } else if (MUSIC_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'music', MUSIC_SELECTOR_FLAGS[flag] ?? null, MUSIC_REMOTE_SET)
      } else if (STT_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'transcribe', STT_SELECTOR_FLAGS[flag] ?? null, STT_REMOTE_SET)
      } else if (OCR_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'extract', OCR_SELECTOR_FLAGS[flag] ?? null, OCR_REMOTE_SET)
      }
    }
  } else if (command === 'tts') {
    for (const { flag, value } of flagValues) {
      if (flag === 'provider' || flag === 'tts') {
        addGroup(groups, 'tts', normalizedStepValue(value), TTS_REMOTE_SET)
      } else if (flag === 'all-providers') {
        addAllGroups(groups, 'tts', TTS_REMOTE_PROVIDERS)
      } else if (TTS_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'tts', TTS_SELECTOR_FLAGS[flag] ?? null, TTS_REMOTE_SET)
      }
    }
  } else if (command === 'image') {
    for (const { flag, value } of flagValues) {
      if (flag === 'provider' || flag === 'image') {
        addGroup(groups, 'image', normalizedStepValue(value), IMAGE_REMOTE_SET)
      } else if (flag === 'all-providers') {
        addAllGroups(groups, 'image', IMAGE_REMOTE_PROVIDERS)
      } else if (IMAGE_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'image', IMAGE_SELECTOR_FLAGS[flag] ?? null, IMAGE_REMOTE_SET)
      }
    }
  } else if (command === 'video') {
    for (const { flag, value } of flagValues) {
      if (flag === 'provider' || flag === 'video') {
        addGroup(groups, 'video', normalizedStepValue(value), VIDEO_REMOTE_SET)
      } else if (flag === 'all-providers') {
        addAllGroups(groups, 'video', VIDEO_REMOTE_PROVIDERS)
      } else if (VIDEO_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'video', VIDEO_SELECTOR_FLAGS[flag] ?? null, VIDEO_REMOTE_SET)
      }
    }
  } else if (command === 'music') {
    for (const { flag, value } of flagValues) {
      if (flag === 'provider' || flag === 'music') {
        addGroup(groups, 'music', normalizedStepValue(value), MUSIC_REMOTE_SET)
      } else if (flag === 'all-providers') {
        addAllGroups(groups, 'music', MUSIC_REMOTE_PROVIDERS)
      } else if (MUSIC_SELECTOR_FLAGS[flag]) {
        addGroup(groups, 'music', MUSIC_SELECTOR_FLAGS[flag] ?? null, MUSIC_REMOTE_SET)
      }
    }
  }

  return [...groups].sort((left, right) => left.localeCompare(right))
}
