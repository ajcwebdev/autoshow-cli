import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS,
  WRITE_STT_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import type { AdaptiveProviderFlagValue, AdaptiveProviderGroup, AdaptiveProviderGroupKind, SimpleMediaCommand } from '~/types'

const LOCAL_STT_PROVIDERS = ['whisper', 'whisperfile'] as const satisfies readonly (keyof typeof WRITE_STT_PROVIDER_TARGETS)[]
const LOCAL_OCR_PROVIDERS = ['tesseract'] as const satisfies readonly (keyof typeof WRITE_OCR_PROVIDER_TARGETS)[]
const LOCAL_URL_PROVIDERS = ['defuddle'] as const satisfies readonly (typeof URL_ARTICLE_BACKENDS)[number][]
const LOCAL_LLM_PROVIDERS = [] as const satisfies readonly (keyof typeof WRITE_LLM_PROVIDER_TARGETS)[]
const LOCAL_TTS_PROVIDERS = [] as const satisfies readonly (keyof typeof STANDALONE_TTS_PROVIDER_TARGETS)[]

const withoutLocalProviders = (
  providers: readonly string[],
  localProviders: readonly string[]
): string[] => {
  const localProviderSet = new Set(localProviders)
  return providers.filter((provider) => !localProviderSet.has(provider))
}

const withoutLocalProviderTargets = (
  targets: Readonly<Record<string, string>>,
  localProviders: readonly string[]
): Record<string, string> => {
  const localProviderSet = new Set(localProviders)
  return Object.fromEntries(
    Object.entries(targets).filter(([provider]) => !localProviderSet.has(provider))
  )
}

const STT_REMOTE_PROVIDER_TARGETS = withoutLocalProviderTargets(WRITE_STT_PROVIDER_TARGETS, LOCAL_STT_PROVIDERS)
const OCR_REMOTE_PROVIDER_TARGETS = withoutLocalProviderTargets(WRITE_OCR_PROVIDER_TARGETS, LOCAL_OCR_PROVIDERS)
const LLM_REMOTE_PROVIDER_TARGETS = withoutLocalProviderTargets(WRITE_LLM_PROVIDER_TARGETS, LOCAL_LLM_PROVIDERS)
const TTS_REMOTE_PROVIDER_TARGETS = withoutLocalProviderTargets(STANDALONE_TTS_PROVIDER_TARGETS, LOCAL_TTS_PROVIDERS)

export const ADAPTIVE_REMOTE_PROVIDERS = {
  stt: Object.keys(STT_REMOTE_PROVIDER_TARGETS),
  ocr: Object.keys(OCR_REMOTE_PROVIDER_TARGETS),
  url: withoutLocalProviders(URL_ARTICLE_BACKENDS, LOCAL_URL_PROVIDERS),
  llm: Object.keys(LLM_REMOTE_PROVIDER_TARGETS),
  tts: Object.keys(TTS_REMOTE_PROVIDER_TARGETS),
  image: Object.keys(STANDALONE_IMAGE_PROVIDER_TARGETS),
  video: Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS),
  music: Object.keys(STANDALONE_MUSIC_PROVIDER_TARGETS)
} as const

const STT_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.stt
const OCR_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.ocr
const URL_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.url
const LLM_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.llm
const TTS_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.tts
const IMAGE_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.image
const VIDEO_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.video
const MUSIC_REMOTE_PROVIDERS = ADAPTIVE_REMOTE_PROVIDERS.music

const STT_REMOTE_SET = new Set<string>(STT_REMOTE_PROVIDERS)
const OCR_REMOTE_SET = new Set<string>(OCR_REMOTE_PROVIDERS)
const URL_REMOTE_SET = new Set<string>(URL_REMOTE_PROVIDERS)
const LLM_REMOTE_SET = new Set<string>(LLM_REMOTE_PROVIDERS)
const TTS_REMOTE_SET = new Set<string>(TTS_REMOTE_PROVIDERS)
const IMAGE_REMOTE_SET = new Set<string>(IMAGE_REMOTE_PROVIDERS)
const VIDEO_REMOTE_SET = new Set<string>(VIDEO_REMOTE_PROVIDERS)
const MUSIC_REMOTE_SET = new Set<string>(MUSIC_REMOTE_PROVIDERS)

const CORE_VALUE_FLAGS = [
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
  'whisper',
  'deepinfra',
] as const

export const ADAPTIVE_PROVIDER_VALUE_FLAGS = [
  ...CORE_VALUE_FLAGS,
  ...new Set([
    ...Object.values(STT_REMOTE_PROVIDER_TARGETS),
    ...Object.values(OCR_REMOTE_PROVIDER_TARGETS),
    ...Object.values(LLM_REMOTE_PROVIDER_TARGETS),
    ...Object.values(TTS_REMOTE_PROVIDER_TARGETS),
    ...Object.values(STANDALONE_IMAGE_PROVIDER_TARGETS),
    ...Object.values(STANDALONE_VIDEO_PROVIDER_TARGETS),
    ...Object.values(STANDALONE_MUSIC_PROVIDER_TARGETS)
  ])
] as const

const VALUE_FLAGS = new Set<string>(ADAPTIVE_PROVIDER_VALUE_FLAGS)

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

const parseProviderName = (token: string | null | undefined): string | null => {
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
  if (provider.includes('stt') || provider === 'whisper') {
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

/** `write --all-providers <step>` fans out over every remote provider for that step. */
const WRITE_ALL_PROVIDER_STEPS: Record<string, { kind: AdaptiveProviderGroupKind, providers: readonly string[] }> = {
  stt: { kind: 'transcribe', providers: STT_REMOTE_PROVIDERS },
  ocr: { kind: 'extract', providers: OCR_REMOTE_PROVIDERS },
  url: { kind: 'url', providers: URL_REMOTE_PROVIDERS },
  llm: { kind: 'write', providers: LLM_REMOTE_PROVIDERS },
}

/** `write <flag> <provider>` selects a single remote provider for that step. */
const WRITE_FLAG_GROUPS: Record<string, { kind: AdaptiveProviderGroupKind, remoteSet: Set<string> }> = {
  'stt': { kind: 'transcribe', remoteSet: STT_REMOTE_SET },
  'ocr': { kind: 'extract', remoteSet: OCR_REMOTE_SET },
  'url-provider': { kind: 'url', remoteSet: URL_REMOTE_SET },
  'llm': { kind: 'write', remoteSet: LLM_REMOTE_SET },
}

/** Commands whose only provider surface is `--provider`/`--<command>` plus `--all-providers`. */
const SIMPLE_MEDIA_COMMANDS = {
  tts: { kind: 'tts', remoteSet: TTS_REMOTE_SET, providers: TTS_REMOTE_PROVIDERS },
  image: { kind: 'image', remoteSet: IMAGE_REMOTE_SET, providers: IMAGE_REMOTE_PROVIDERS },
  video: { kind: 'video', remoteSet: VIDEO_REMOTE_SET, providers: VIDEO_REMOTE_PROVIDERS },
  music: { kind: 'music', remoteSet: MUSIC_REMOTE_SET, providers: MUSIC_REMOTE_PROVIDERS },
} as const satisfies Record<SimpleMediaCommand, { kind: AdaptiveProviderGroupKind, remoteSet: Set<string>, providers: readonly string[] }>

const isSimpleMediaCommand = (command: string): command is SimpleMediaCommand =>
  Object.hasOwn(SIMPLE_MEDIA_COMMANDS, command)

const addWriteAllProviderGroups = (
  groups: Set<AdaptiveProviderGroup>,
  value: string | null
): void => {
  const target = value === null ? undefined : WRITE_ALL_PROVIDER_STEPS[value]
  if (!target) {
    return
  }

  addAllGroups(groups, target.kind, target.providers)
}

const normalizedStepValue = (value: string | null): string | null => {
  const provider = parseProviderName(value)
  if (!provider) {
    return null
  }
  return provider
}

const applyExtractFlag = (
  groups: Set<AdaptiveProviderGroup>,
  input: string | null,
  { flag, value }: AdaptiveProviderFlagValue
): void => {
  if (flag === 'provider') {
    addExtractProviderGroup(groups, input, parseProviderName(value))
    return
  }
  if (flag === 'url-provider') {
    addGroup(groups, 'url', parseProviderName(value), URL_REMOTE_SET)
    return
  }
  if (flag === 'all-providers') {
    addAllExtractGroups(groups, input)
  }
}

const applyWriteFlag = (
  groups: Set<AdaptiveProviderGroup>,
  { flag, value }: AdaptiveProviderFlagValue
): void => {
  if (flag === 'all-providers') {
    addWriteAllProviderGroups(groups, value?.trim().toLowerCase() ?? null)
    return
  }

  const target = WRITE_FLAG_GROUPS[flag]
  if (!target) {
    return
  }

  addGroup(groups, target.kind, normalizedStepValue(value), target.remoteSet)
}

const applySimpleMediaFlag = (
  groups: Set<AdaptiveProviderGroup>,
  command: SimpleMediaCommand,
  { flag, value }: AdaptiveProviderFlagValue
): void => {
  const target = SIMPLE_MEDIA_COMMANDS[command]
  if (flag === 'provider' || flag === command) {
    addGroup(groups, target.kind, normalizedStepValue(value), target.remoteSet)
    return
  }
  if (flag === 'all-providers') {
    addAllGroups(groups, target.kind, target.providers)
  }
}

const resolveFlagApplier = (
  command: string | undefined,
  input: string | null
): ((groups: Set<AdaptiveProviderGroup>, flagValue: AdaptiveProviderFlagValue) => void) | null => {
  if (command === 'extract') {
    return (groups, flagValue) => applyExtractFlag(groups, input, flagValue)
  }
  if (command === 'write') {
    return applyWriteFlag
  }
  if (command && isSimpleMediaCommand(command)) {
    return (groups, flagValue) => applySimpleMediaFlag(groups, command, flagValue)
  }
  return null
}

export const extractAdaptiveProviderGroups = (args: string[]): AdaptiveProviderGroup[] => {
  if (args[0] !== 'src/cli/create-cli.ts') {
    return []
  }

  const applyFlag = resolveFlagApplier(args[1], firstPositionalAfterCommand(args))
  if (!applyFlag) {
    return []
  }

  const groups = new Set<AdaptiveProviderGroup>()
  for (const flagValue of collectFlagValues(args)) {
    applyFlag(groups, flagValue)
  }

  return [...groups].sort((left, right) => left.localeCompare(right))
}
