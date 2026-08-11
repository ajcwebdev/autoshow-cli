import { expect, test } from 'bun:test'
import { runCommand } from '../../../test-utils/test-helpers'
import {
  IMAGE_GENERATION_QUALITIES,
  LOG_LEVELS,
  OUTPUT_FORMATS,
  RUNTIME_TOOL_IDS,
  SETUP_STEP_IDS,
  VIDEO_MODES
} from '~/types'
import { LOG_FORMAT_CHOICES } from '~/utils/app-logger/app-logger'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { PDF_CHAPTER_MODES } from '~/cli/options/option-resolution/flag-readers'
import {
  GEMINI_VIDEO_RESOLUTIONS,
  GLM_COGVIDEOX_SIZE_VALUES,
  GLM_VIDU2_SIZE_VALUES,
  GROK_VIDEO_ASPECT_RATIOS,
  LTX_2_3_SIZE_VALUES,
  LUMA_ASPECT_RATIOS,
  LUMA_RESOLUTIONS,
  REPLICATE_VIDEO_RESOLUTIONS,
  RUNWAY_ASPECT_RATIO_INPUTS
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { GEMINI_IMAGE_RESPONSE_MODES, GEMINI_IMAGE_SIZE_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-gemini/gemini-image-targets'
import { OPENAI_FIXED_IMAGE_SIZE_VALUES, OPENAI_IMAGE_BACKGROUND_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-openai/openai-image-targets'
import { LUMALABS_MAX_IMAGE_INPUTS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/lumalabs-image-targets'
import { ELEVENLABS_MAX_DURATION_SECONDS, ELEVENLABS_MIN_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-elevenlabs/run-elevenlabs-music-gen'
import { GEMINI_CLIP_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { SPEECHIFY_CUSTOM_VOICE_GENDERS } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import {
  SUPPORTED_HUME_TTS_VOICE_PROVIDERS,
  SUPPORTED_MINIMAX_TTS_EMOTIONS,
  SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS,
  SUPPORTED_WHISPER_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

const helpEnv = { NO_COLOR: '1' }
const removedSetupCommand = ['so', 'ck'].join('')
const topLevelCommands = [
  'version', 'help', 'config', 'setup', 'links', 'resume', 'benchmark',
  'metadata', 'download', 'extract', 'write', 'tts', 'voice', 'image', 'video', 'music', 'comic'
] as const
const comicSubcommands = ['draft-scenes', 'generate-images', 'reference-sketch', 'reference-voice'] as const

const getSection = (output: string, heading: string, nextHeading?: string): string => {
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)

  const sectionStart = start + heading.length
  const end = nextHeading ? output.indexOf(nextHeading, sectionStart) : output.length
  expect(end).toBeGreaterThan(sectionStart)

  return output.slice(sectionStart, end)
}

const getFlagGroupSection = (output: string, label: string): string => {
  const heading = `\n  ${label}\n`
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)

  const sectionStart = start + heading.length
  const tail = output.slice(sectionStart)
  const nextGroup = tail.match(/\n  [A-Za-z0-9][^\n]*\n/)
  const globalFlags = output.indexOf('\nGlobal Flags\n', sectionStart)
  const nextGroupEnd = nextGroup?.index === undefined ? output.length : sectionStart + nextGroup.index
  const globalFlagsEnd = globalFlags === -1 ? output.length : globalFlags
  return output.slice(sectionStart, Math.min(nextGroupEnd, globalFlagsEnd))
}

// Command-specific flags only; excludes the shared Global Flags block, whose
// --characters-root/--color entries would otherwise match narrower flag names.
const getCommandFlagsSection = (output: string): string => {
  const start = output.indexOf('\nFlags\n')
  if (start === -1) {
    return ''
  }
  const end = output.indexOf('\nGlobal Flags\n', start)
  return output.slice(start, end === -1 ? output.length : end)
}

test('root help groups setup utilities separately from processing commands', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('Extract and write content, manage voices, generate speech, images, video, and music, and build comic workflows')

  const setupSection = getSection(result.stdout, '  Setup & Utilities\n', '  Processing & Generation\n')
  const processingSection = getSection(result.stdout, '  Processing & Generation\n')

  expect(setupSection).toContain('    links')
  expect(setupSection).toContain('    setup')
  expect(setupSection).toContain('    resume')
  expect(setupSection).not.toContain(`    ${removedSetupCommand}`)
  expect(setupSection).not.toContain('    cache')
  expect(processingSection).toContain('    write')
  expect(processingSection.indexOf('    video')).toBeLessThan(processingSection.indexOf('    music'))
  expect(processingSection).not.toContain('    lyrics')
  expect(processingSection).not.toContain('    stt')
  expect(processingSection).not.toContain('    ocr')
  expect(processingSection).not.toContain('    links')
  expect(processingSection).not.toContain('    resume')
})

test('every built-in, top-level command, and comic subcommand renders help with its public usage', async () => {
  for (const command of topLevelCommands) {
    const result = await runCommand(['src/cli/create-cli.ts', command, '--help'], { env: helpEnv })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`$ bun autoshow ${command}`)
  }

  for (const subcommand of comicSubcommands) {
    const result = await runCommand(['src/cli/create-cli.ts', 'comic', subcommand, '--help'], { env: helpEnv })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`bun autoshow comic ${subcommand}`)
  }

  const links = await runCommand(['src/cli/create-cli.ts', 'links', '--help'], { env: helpEnv })
  const video = await runCommand(['src/cli/create-cli.ts', 'video', '--help'], { env: helpEnv })
  const help = await runCommand(['src/cli/create-cli.ts', 'help', '--help'], { env: helpEnv })
  expect(links.stdout).toContain('$ bun autoshow links [selection...] [flags]')
  expect(video.stdout).toContain('$ bun autoshow video <input> [flags]')
  expect(help.stdout).toContain('$ bun autoshow help [command] [flags]')
  expect(help.stdout).not.toContain('[command...]')
})

test('links help includes models selector example', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'links', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('bun autoshow links models')
  expect(result.stdout).toContain('Fetch model documentation across every provider')
  expect(result.stdout).toContain('--refresh')
  expect(result.stdout).toContain('Write refresh metadata sidecar')
})

test('metadata help groups document, output, article, and batch flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'metadata', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(getFlagGroupSection(result.stdout, 'Document Options')).toContain('--password')
  expect(getFlagGroupSection(result.stdout, 'Metadata Output')).toContain('--markdown')
  expect(getFlagGroupSection(result.stdout, 'Metadata Output')).toContain('--save')
  expect(getFlagGroupSection(result.stdout, 'Article Extraction')).toContain('--url-provider')
  expect(getFlagGroupSection(result.stdout, 'Batch Processing')).toContain('--batch-limit')
})

test('extract help exposes shared batch and all-provider flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'extract', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  const providerSection = getFlagGroupSection(result.stdout, 'Provider Selection')
  const transcriptionSection = getFlagGroupSection(result.stdout, 'Transcription / STT')
  const documentSection = getFlagGroupSection(result.stdout, 'OCR / Document Extraction')
  const articleSection = getFlagGroupSection(result.stdout, 'Article Extraction')
  const batchSection = getFlagGroupSection(result.stdout, 'Batch Processing')
  const epubSection = getFlagGroupSection(result.stdout, 'EPUB Inspect')
  const transcriptVideoSection = getFlagGroupSection(result.stdout, 'Transcript Video')
  const pricingSection = getFlagGroupSection(result.stdout, 'Pricing')

  expect(providerSection).toContain('--provider')
  expect(providerSection).toContain('--all-providers')
  expect(providerSection).toContain('--all-local')
  expect(providerSection).toContain('--provider-concurrency')
  expect(providerSection).toContain('--local-concurrency')
  expect(transcriptionSection).toContain('--stt-scrapecreators-lang')
  expect(transcriptionSection).not.toContain('--refresh-cache')
  expect(transcriptionSection).not.toContain('--no-cache')
  expect(documentSection).toContain('--format')
  expect(documentSection).toContain('--primary-ocr')
  expect(documentSection).toContain('--ocr-concurrency')
  expect(documentSection).toContain('Local OCR defaults to 10')
  expect(documentSection).toContain('hosted OCR defaults to auto')
  expect(documentSection).toContain('--chapters')
  expect(documentSection).toContain('--no-chapters')
  expect(articleSection).toContain('--url-request-timeout-ms')
  expect(articleSection).toContain('--url-request-attempts')
  expect(batchSection).toContain('--batch-limit')
  expect(epubSection).toContain('--epub-bun')
  expect(transcriptVideoSection).toContain('--transcript-video')
  expect(transcriptVideoSection).toContain('--transcript-result')
  expect(transcriptVideoSection).toContain('--transcript-text')
  expect(pricingSection).toContain('--price')
  expect(result.stdout).toContain('--batch-limit')
  expect(result.stdout).toContain('--batch-all')
  expect(result.stdout).toContain('--batch-concurrency')
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--all-providers')
  expect(result.stdout).toContain('--all-local')
  expect(result.stdout).not.toContain('--all-stt')
  expect(result.stdout).not.toContain('--all-ocr')
  expect(result.stdout).not.toContain('--all-url')
  expect(result.stdout).not.toContain('--grok-stt')
  expect(result.stdout).not.toContain('--glm-ocr')
  expect(result.stdout).toContain('--stt-scrapecreators-lang')
  expect(result.stdout).not.toContain('--refresh-cache')
  expect(result.stdout).not.toContain('--no-cache')
  expect(result.stdout).toContain('--provider-concurrency')
  expect(result.stdout).toContain('--local-concurrency')
  expect(result.stdout).not.toContain('--ocr-provider-concurrency')
  expect(result.stdout).not.toContain('--url-provider-concurrency')
  expect(result.stdout).toContain('--url-request-timeout-ms')
  expect(result.stdout).toContain('--url-request-attempts')
  expect(result.stdout).toContain('--transcript-video')
  expect(result.stdout).toContain('--transcript-result')
  expect(result.stdout).toContain('--transcript-text')
})

test('download help exposes media preservation flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'download', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(getFlagGroupSection(result.stdout, 'Document Options')).toContain('--password')
  const mediaSection = getFlagGroupSection(result.stdout, 'Media Download Options')
  expect(mediaSection).toContain('--keep-original-media')
  expect(mediaSection).toContain('--best-quality')
  expect(mediaSection).toContain('--flat-batch')
  expect(getFlagGroupSection(result.stdout, 'Article Extraction')).toContain('--url-provider')
  expect(getFlagGroupSection(result.stdout, 'Batch Processing')).toContain('--batch-limit')
  expect(result.stdout).toContain('--keep-original-media')
  expect(result.stdout).toContain('--best-quality')
  expect(result.stdout).toContain('--flat-batch')
})

test('benchmark help exposes TTS voice-quality scoring flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'benchmark', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--tts')
  expect(result.stdout).toContain('--tts-input-text')
  expect(result.stdout).toContain('--tts-mode')
  expect(result.stdout).toContain('--tts-roundtrip-dir')
  expect(result.stdout).toContain('--tts-metric-fixtures')
  expect(result.stdout).toContain('--tts-audio-judge-model')
  expect(result.stdout).toContain('gpt-audio')
  expect(result.stdout).toContain('--tts-keep-temp')
})

test('benchmark help exposes image quality scoring flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'benchmark', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--image')
  expect(result.stdout).toContain('--image-judge-model')
  expect(result.stdout).toContain('gpt-5.5')
})

test('benchmark help exposes text write scoring flag', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'benchmark', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--text')
  expect(result.stdout).toContain('Score an existing write run directory without calling LLM providers')
  expect(result.stdout).toContain('docs/benchmarks/write/<run> --text')
  expect(result.stdout).toContain('Score an existing write run without paid calls')
})

test('benchmark help exposes video quality scoring flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'benchmark', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--video')
  expect(result.stdout).toContain('--video-judge-model')
  expect(result.stdout).toContain('gpt-5.5')
})

test('tts help exposes hosted TTS provider flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'tts', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(getFlagGroupSection(result.stdout, 'Provider Selection')).toContain('--provider')
  expect(getFlagGroupSection(result.stdout, 'Provider Selection')).toContain('--provider-concurrency')
  expect(getFlagGroupSection(result.stdout, 'TTS Options')).toContain('--tts-voice')
  expect(getFlagGroupSection(result.stdout, 'TTS Options')).toContain('--tts-chunk-concurrency')
  expect(getFlagGroupSection(result.stdout, 'Batch Processing')).toContain('--batch-concurrency')
  expect(getFlagGroupSection(result.stdout, 'MiniMax TTS')).toContain('--minimax-tts-language-boost')
  expect(getFlagGroupSection(result.stdout, 'Deepgram TTS')).toContain('--deepgram-tts-sample-rate')
  expect(getFlagGroupSection(result.stdout, 'Speechify TTS')).toContain('--speechify-tts-voice-locale')
  expect(getFlagGroupSection(result.stdout, 'Hume TTS')).toContain('--hume-tts-voice-provider')
  expect(getFlagGroupSection(result.stdout, 'Multi-Speaker / Dialogue')).toContain('--tts-dialogue-format')
  expect(getFlagGroupSection(result.stdout, 'ElevenLabs TTS')).toContain('--elevenlabs-tts-stability')
  expect(getFlagGroupSection(result.stdout, 'Pricing')).toContain('--price')
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--all-providers')
  expect(result.stdout).toContain('--all-local')
  expect(result.stdout).toContain('--provider-concurrency')
  expect(result.stdout).toContain('--local-concurrency')
  expect(result.stdout).toContain('--tts-voice')
  expect(result.stdout).toContain('--tts-speed')
  expect(result.stdout).toContain('--tts-language')
  expect(result.stdout).toContain('--tts-ref-audio')
  expect(result.stdout).toContain('--tts-voice-name')
  expect(result.stdout).not.toContain('--tts-consent-audio')
  expect(result.stdout).not.toContain('--tts-consent-language')
  expect(result.stdout).toContain('--tts-consent-name')
  expect(result.stdout).toContain('--tts-consent-email')
  expect(result.stdout).toContain('--tts-text-normalization')
  expect(result.stdout).toContain('--tts-instructions')
  expect(result.stdout).toContain('--tts-chunk-concurrency')
  expect(result.stdout).toContain('Grok-only default 50')
  expect(result.stdout).toContain('--batch-concurrency')
  expect(result.stdout).not.toContain('--batch-limit')
  expect(result.stdout).not.toContain('--batch-all')
  expect(result.stdout).not.toContain('--grok-tts  ')
  expect(result.stdout).not.toContain('--grok-tts-voice')
  expect(result.stdout).not.toContain('--grok-tts-language')
  expect(result.stdout).not.toContain('--grok-tts-text-normalization')
  expect(result.stdout).not.toContain('--mistral-tts  ')
  expect(result.stdout).not.toContain('--mistral-tts-voice')
  expect(result.stdout).not.toContain('--mistral-tts-ref-audio')
  expect(result.stdout).not.toContain('--mistral-tts-voice-name')
  expect(result.stdout).not.toContain('--deepgram-tts-encoding')
  expect(result.stdout).toContain('--deepgram-tts-container')
  expect(result.stdout).toContain('--deepgram-tts-bit-rate')
  expect(result.stdout).toContain('--deepgram-tts-sample-rate')
  expect(result.stdout).not.toContain('--deepgram-tts-speed')
  expect(result.stdout).not.toContain('--minimax-tts-voice')
  expect(result.stdout).not.toContain('--minimax-tts-ref-audio')
  expect(result.stdout).not.toContain('--minimax-tts-prompt-audio')
  expect(result.stdout).not.toContain('--minimax-tts-prompt-text')
  expect(result.stdout).not.toContain('--minimax-tts-clone-noise-reduction')
  expect(result.stdout).not.toContain('--minimax-tts-clone-volume-normalization')
  expect(result.stdout).toContain('--minimax-tts-language-boost')
  expect(result.stdout).not.toContain('--minimax-tts-speed')
  expect(result.stdout).toContain('--minimax-tts-volume')
  expect(result.stdout).toContain('--minimax-tts-pitch')
  expect(result.stdout).toContain('--minimax-tts-emotion')
  expect(result.stdout).not.toContain('--minimax-tts-english-normalization')
  expect(result.stdout).toContain('--minimax-tts-pronunciation')
  expect(result.stdout).not.toContain('--openai-tts-instructions')
  expect(result.stdout).not.toContain('--openai-tts-speed')
  expect(result.stdout).not.toContain('--openai-tts-ref-audio')
  expect(result.stdout).not.toContain('--openai-tts-consent-id')
  expect(result.stdout).not.toContain('--openai-tts-consent-audio')
  expect(result.stdout).not.toContain('--openai-tts-consent-language')
  expect(result.stdout).not.toContain('--openai-tts-consent-name')
  expect(result.stdout).not.toContain('--openai-tts-voice-name')
  expect(result.stdout).not.toContain('--runway-tts')
  expect(result.stdout).not.toContain('--runway-tts-voice')
  expect(result.stdout).not.toContain('--speechify-tts  ')
  expect(result.stdout).not.toContain('--speechify-voice')
  expect(result.stdout).not.toContain('--speechify-tts-audio-format')
  expect(result.stdout).not.toContain('--speechify-tts-language')
  expect(result.stdout).not.toContain('--speechify-tts-ref-audio')
  expect(result.stdout).not.toContain('--speechify-tts-voice-name')
  expect(result.stdout).not.toContain('--speechify-tts-consent-name')
  expect(result.stdout).not.toContain('--speechify-tts-consent-email')
  expect(result.stdout).toContain('--speechify-tts-voice-locale')
  expect(result.stdout).toContain('--speechify-tts-voice-gender')
  expect(result.stdout).not.toContain('--hume-tts  ')
  expect(result.stdout).toContain('--hume-tts-voice-provider')
  expect(result.stdout).not.toContain('--cartesia-tts  ')
  expect(result.stdout).not.toContain('--cartesia-tts-voice')
  expect(result.stdout).not.toContain('--cartesia-tts-language')
  expect(result.stdout).not.toContain('--elevenlabs-tts-output-format')
  expect(result.stdout).not.toContain('--elevenlabs-tts-language-code')
  expect(result.stdout).toContain('--elevenlabs-tts-stability')
  expect(result.stdout).toContain('--elevenlabs-tts-similarity-boost')
  expect(result.stdout).toContain('--elevenlabs-tts-style')
  expect(result.stdout).toContain('--elevenlabs-tts-use-speaker-boost')
  expect(result.stdout).not.toContain('--elevenlabs-tts-speed')
  expect(result.stdout).toContain('--elevenlabs-tts-seed')
  expect(result.stdout).not.toContain('--elevenlabs-tts-text-normalization')
  expect(result.stdout).toContain('--elevenlabs-tts-pronunciation-dictionary-locator')
  expect(result.stdout).toContain('--elevenlabs-tts-optimize-streaming-latency')
})

test('write and config help expose shared selectors and concurrency flags', async () => {
  const writeResult = await runCommand(['src/cli/create-cli.ts', 'write', '--help'], { env: helpEnv })
  const configResult = await runCommand(['src/cli/create-cli.ts', 'config', '--help'], { env: helpEnv })

  expect(writeResult.exitCode).toBe(0)
  expect(configResult.exitCode).toBe(0)
  const pipelineSection = getFlagGroupSection(writeResult.stdout, 'Pipeline Selection')
  expect(pipelineSection).toContain('--provider-concurrency')
  expect(pipelineSection).toContain('--local-concurrency')
  expect(pipelineSection).toContain('--all-providers')
  expect(pipelineSection).toContain('--all-local')
  expect(pipelineSection).toContain('--llm')
  expect(getFlagGroupSection(writeResult.stdout, 'Batch / Download')).toContain('--batch-limit')
  expect(getFlagGroupSection(configResult.stdout, 'Concurrency')).toContain('--provider-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Concurrency')).toContain('--local-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Batch / Download')).toContain('--batch-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Pricing')).not.toContain('--provider-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Pricing')).not.toContain('--local-concurrency')
  expect(getFlagGroupSection(writeResult.stdout, 'Extraction')).toContain('--ocr-language')
  expect(getFlagGroupSection(writeResult.stdout, 'Extraction')).toContain('--ocr-concurrency')
  expect(getFlagGroupSection(writeResult.stdout, 'Extraction')).toContain('default 10')
  expect(getFlagGroupSection(writeResult.stdout, 'Writing')).toContain('--prompt')
  expect(getFlagGroupSection(writeResult.stdout, 'TTS Options')).toContain('--tts-voice')
  expect(getFlagGroupSection(writeResult.stdout, 'TTS Options')).toContain('--tts-chunk-concurrency')
  expect(getFlagGroupSection(writeResult.stdout, 'Step 5 - Image')).toContain('--image-aspect-ratio')
  expect(getFlagGroupSection(writeResult.stdout, 'Step 6 - Video')).toContain('--video-mode')
  expect(getFlagGroupSection(writeResult.stdout, 'Step 7 - Music')).toContain('--music-duration')

  const step7Start = writeResult.stdout.indexOf('\n  Step 7 - Music\n')
  expect(step7Start).toBeGreaterThanOrEqual(0)
  const globalFlagsStart = writeResult.stdout.indexOf('\nGlobal Flags\n', step7Start)
  expect(globalFlagsStart).toBeGreaterThan(step7Start)
  const afterStep7BeforeGlobal = writeResult.stdout.slice(step7Start, globalFlagsStart)
  expect(afterStep7BeforeGlobal).not.toContain('\n  --provider-concurrency')
  expect(afterStep7BeforeGlobal).not.toContain('\n  --local-concurrency')
  expect(afterStep7BeforeGlobal).not.toContain('\n  --all-providers')
  expect(afterStep7BeforeGlobal).not.toContain('\n  --all-local')
  expect(writeResult.stdout).toContain('--provider-concurrency')
  expect(writeResult.stdout).toContain('--local-concurrency')
  expect(writeResult.stdout).toContain('--stt')
  expect(writeResult.stdout).toContain('--ocr')
  expect(writeResult.stdout).toContain('--llm')
  expect(writeResult.stdout).toContain('grok=grok-4.5')
  expect(writeResult.stdout).toContain('--tts')
  expect(writeResult.stdout).toContain('--image')
  expect(writeResult.stdout).toContain('gemini|openai|grok|bfl|recraft|replicate')
  expect(writeResult.stdout).toContain('--video')
  expect(writeResult.stdout).toContain('--music')
  expect(writeResult.stdout).toContain('--all-providers')
  expect(writeResult.stdout).toContain('--all-local')
  expect(writeResult.stdout).not.toContain('--llm-provider-concurrency')
  expect(writeResult.stdout).not.toContain('--mistral-stt')
  expect(configResult.stdout).toContain('--provider-concurrency')
  expect(configResult.stdout).toContain('--local-concurrency')
  expect(configResult.stdout).toContain('--stt')
  expect(configResult.stdout).toContain('--ocr')
  expect(configResult.stdout).toContain('--llm')
  expect(configResult.stdout).toContain('--tts')
  expect(configResult.stdout).toContain('gemini|openai|grok|bfl|recraft|replicate')
  expect(configResult.stdout).toContain('--tts-chunk-concurrency')
  expect(writeResult.stdout).toContain('Grok-only default 50')
  expect(configResult.stdout).toContain('Grok-only default 50')
  expect(configResult.stdout).toContain('--ocr-concurrency')
  expect(configResult.stdout).not.toContain('--llm-provider-concurrency')
  expect(configResult.stdout).not.toContain('--mistral-stt')
  expect(configResult.stdout).not.toContain('openai=gpt-5.4 --stt')
  expect(writeResult.stdout).not.toContain(['MiniMax-M2', '5'].join('.'))
  expect(configResult.stdout).not.toContain(['MiniMax-M2', '5'].join('.'))
})

test('music help includes hosted generation and lyric-video flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'music', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(getFlagGroupSection(result.stdout, 'Provider Selection')).toContain('--provider')
  expect(getFlagGroupSection(result.stdout, 'Hosted Music')).toContain('--duration')
  expect(getFlagGroupSection(result.stdout, 'Hosted Music')).toContain('--lyrics-file')
  expect(getFlagGroupSection(result.stdout, 'Pricing')).toContain('--price')
  expect(getFlagGroupSection(result.stdout, 'Lyric Video')).toContain('--audio')
  expect(getFlagGroupSection(result.stdout, 'Lyric Video')).toContain('--captions')
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--all-providers')
  expect(result.stdout).not.toContain('--all-local')
  expect(result.stdout).not.toContain('--elevenlabs-music')
  expect(result.stdout).not.toContain('--minimax-music')
  expect(result.stdout).not.toContain('--gemini-music')
  expect(result.stdout).toContain('--provider-concurrency')
  expect(result.stdout).not.toContain('--local-concurrency')
  expect(result.stdout).toContain('--duration')
  expect(result.stdout).toContain('--lyrics-file')
  expect(result.stdout).toContain('--instrumental')
  expect(result.stdout).not.toContain('--music-duration')
  expect(result.stdout).not.toContain('--music-lyrics-file')
  expect(result.stdout).toContain('--price')
  expect(result.stdout).toContain('--audio')
  expect(result.stdout).toContain('--captions')
  expect(result.stdout).toContain('--batch')
  expect(result.stdout).toContain('--model')
  expect(result.stdout).toContain('--font')
  expect(result.stdout).toContain('--keep-tmp')
  expect(result.stdout).not.toContain('--openai')
  expect(result.stdout).not.toContain('--prompt')
  expect(result.stdout).not.toContain('--prompt-file')
  expect(result.stdout).not.toContain('--track-list')
})

test('image and video help expose generic provider selection plus their own option groups', async () => {
  const imageResult = await runCommand(['src/cli/create-cli.ts', 'image', '--help'], { env: helpEnv })
  const videoResult = await runCommand(['src/cli/create-cli.ts', 'video', '--help'], { env: helpEnv })

  expect(imageResult.exitCode).toBe(0)
  expect(videoResult.exitCode).toBe(0)
  expect(getFlagGroupSection(imageResult.stdout, 'Provider Selection')).toContain('--provider')
  expect(getFlagGroupSection(imageResult.stdout, 'Image Options')).toContain('--aspect-ratio')
  expect(getFlagGroupSection(imageResult.stdout, 'Image Inputs')).toContain('--input')
  expect(getFlagGroupSection(imageResult.stdout, 'Provider-Specific Image Options')).toContain('--compression')
  expect(getFlagGroupSection(imageResult.stdout, 'Pricing')).toContain('--price')
  expect(getFlagGroupSection(videoResult.stdout, 'Provider Selection')).toContain('--provider')
  expect(getFlagGroupSection(videoResult.stdout, 'Video Options')).toContain('--mode')
  expect(getFlagGroupSection(videoResult.stdout, 'Video Inputs')).toContain('--input-image')
  expect(getFlagGroupSection(videoResult.stdout, 'Replicate Video')).toContain('--replicate-video-seed')
  expect(getFlagGroupSection(videoResult.stdout, 'Grok Storage Options')).toContain('--grok-video-storage-filename')
  expect(getFlagGroupSection(videoResult.stdout, 'Pricing')).toContain('--price')
  expect(imageResult.stdout).toContain('gpt-image-2')
  expect(imageResult.stdout).toContain('replicate')
  expect(imageResult.stdout).toContain('wan-video/wan-2.7-image')
  expect(videoResult.stdout).toContain('ltx')
  expect(videoResult.stdout).toContain('ltx-2-3-fast')
  expect(videoResult.stdout).toContain('wan-video/wan-2.7-t2v')
  expect(imageResult.stdout).toContain('--provider-concurrency')
  expect(imageResult.stdout).not.toContain('--local-concurrency')
  expect(imageResult.stdout).toContain('--provider')
  expect(imageResult.stdout).toContain('--aspect-ratio')
  expect(imageResult.stdout).toContain('--size')
  expect(imageResult.stdout).toContain('--quality')
  expect(imageResult.stdout).toContain('--format')
  expect(imageResult.stdout).toContain('--count')
  expect(imageResult.stdout).not.toContain('--image-provider-concurrency')
  expect(imageResult.stdout).not.toContain('--image-size')
  expect(imageResult.stdout).not.toContain('--minimax')
  expect(imageResult.stdout).not.toContain('--runway')
  expect(imageResult.stdout).not.toContain('--gemini-person-generation')
  expect(imageResult.stdout).not.toContain('imagen-4.0')
  expect(imageResult.stdout).not.toContain('--glm')
  expect(imageResult.stdout).not.toContain('--bfl-image')
  expect(imageResult.stdout).not.toContain('--replicate-image')
  expect(videoResult.stdout).toContain('--provider-concurrency')
  expect(videoResult.stdout).not.toContain('--local-concurrency')
  expect(videoResult.stdout).toContain('--mode')
  expect(videoResult.stdout).toContain('--input-image')
  expect(videoResult.stdout).toContain('--last-frame')
  expect(videoResult.stdout).toContain('--reference-image')
  expect(videoResult.stdout).toContain('--input-video')
  expect(videoResult.stdout).not.toContain('--video-mode')
  expect(videoResult.stdout).not.toContain('--video-input-image')
  expect(videoResult.stdout).not.toContain('--video-resolution')
  expect(videoResult.stdout).not.toContain('--video-aspect-ratio')
  expect(videoResult.stdout).toContain('Luma Labs')
  expect(videoResult.stdout).toContain('540p|720p|1080p')
  expect(videoResult.stdout).toContain('21:9|9:21|adaptive')
  expect(videoResult.stdout).toContain('--grok-video-storage-filename')
})

test('provider help lists are derived from the supported selector registries', async () => {
  const [extract, write, config, resume, tts] = await Promise.all([
    runCommand(['src/cli/create-cli.ts', 'extract', '--help'], { env: helpEnv }),
    runCommand(['src/cli/create-cli.ts', 'write', '--help'], { env: helpEnv }),
    runCommand(['src/cli/create-cli.ts', 'config', '--help'], { env: helpEnv }),
    runCommand(['src/cli/create-cli.ts', 'resume', '--help'], { env: helpEnv }),
    runCommand(['src/cli/create-cli.ts', 'tts', '--help'], { env: helpEnv })
  ])

  const urlBackends = URL_ARTICLE_BACKENDS.join('|')
  const llmProviders = Object.keys(WRITE_LLM_PROVIDER_TARGETS).join('|')
  const videoProviders = Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS).join('|')

  expect(extract.stdout).toContain('whisperfile')
  expect(extract.stdout).toContain(urlBackends)
  expect(write.stdout).toContain(llmProviders)
  expect(write.stdout).toMatch(/--stt[^\n]*whisperfile/)
  expect(config.stdout).toContain(llmProviders)
  expect(config.stdout).toMatch(/--stt[^\n]*whisperfile/)
  expect(resume.stdout).toContain(`URL: ${urlBackends}`)
  expect(resume.stdout).toContain(`video: ${videoProviders}`)
  expect(tts.stdout).toContain('repeatable (default: kitten)')
})

test('Luma, ratio, and music duration descriptions match supported behavior', async () => {
  const image = await runCommand(['src/cli/create-cli.ts', 'image', '--help'], { env: helpEnv })
  const music = await runCommand(['src/cli/create-cli.ts', 'music', '--help'], { env: helpEnv })

  // Seedream's odd-one-out ratio is match_input_image; `adaptive` belongs to Seedance video.
  expect(image.stdout).toContain('Replicate Seedream also supports match_input_image')
  expect(image.stdout).not.toContain('Replicate Seedream also supports adaptive')
  expect(image.stdout).toContain(`Luma Labs supports up to ${LUMALABS_MAX_IMAGE_INPUTS}`)
  expect(music.stdout).toContain(`ElevenLabs configurable from ${ELEVENLABS_MIN_DURATION_SECONDS}-${ELEVENLABS_MAX_DURATION_SECONDS}`)
  expect(music.stdout).toContain('MiniMax currently ignores this flag')
  expect(music.stdout).toContain(`Gemini Lyria Clip is fixed at ${GEMINI_CLIP_DURATION_SECONDS} seconds`)
  expect(music.stdout).toContain('Gemini Lyria Pro uses the requested duration')
})

// Each entry pins one help description to the constant its validator uses, so adding a
// supported value without documenting it fails here instead of shipping a stale list.
const derivedHelpLists = [
  { command: 'video', label: '--video-mode', values: VIDEO_MODES },
  { command: 'video', label: '--video-size (GLM CogVideoX)', values: GLM_COGVIDEOX_SIZE_VALUES },
  { command: 'video', label: '--video-size (GLM Vidu 2)', values: GLM_VIDU2_SIZE_VALUES },
  { command: 'video', label: '--video-size (LTX)', values: LTX_2_3_SIZE_VALUES },
  { command: 'video', label: '--video-aspect-ratio (Luma Labs)', values: LUMA_ASPECT_RATIOS },
  { command: 'video', label: '--video-aspect-ratio (Grok)', values: GROK_VIDEO_ASPECT_RATIOS },
  { command: 'video', label: '--video-aspect-ratio (Runway)', values: RUNWAY_ASPECT_RATIO_INPUTS },
  { command: 'video', label: '--video-resolution (Gemini)', values: GEMINI_VIDEO_RESOLUTIONS },
  { command: 'video', label: '--video-resolution (Replicate)', values: REPLICATE_VIDEO_RESOLUTIONS },
  { command: 'video', label: '--video-resolution (Luma Labs)', values: LUMA_RESOLUTIONS },
  { command: 'image', label: '--image-quality', values: IMAGE_GENERATION_QUALITIES },
  { command: 'image', label: '--image-size (Gemini)', values: GEMINI_IMAGE_SIZE_VALUES },
  { command: 'image', label: '--image-size (OpenAI)', values: OPENAI_FIXED_IMAGE_SIZE_VALUES },
  { command: 'image', label: '--image-background', values: OPENAI_IMAGE_BACKGROUND_VALUES },
  { command: 'image', label: '--image-response-mode', values: GEMINI_IMAGE_RESPONSE_MODES },
  { command: 'setup', label: '--step', values: SETUP_STEP_IDS },
  { command: 'extract', label: '--format', values: OUTPUT_FORMATS },
  { command: 'extract', label: '--pdf-chapter-mode', values: PDF_CHAPTER_MODES },
  { command: 'extract', label: '--url-provider', values: URL_ARTICLE_BACKENDS },
  { command: 'extract', label: '--primary-ocr', values: Object.keys(WRITE_OCR_PROVIDER_TARGETS) },
  { command: 'tts', label: '--minimax-tts-language-boost', values: SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS },
  { command: 'tts', label: '--minimax-tts-emotion', values: SUPPORTED_MINIMAX_TTS_EMOTIONS },
  { command: 'tts', label: '--hume-tts-voice-provider', values: SUPPORTED_HUME_TTS_VOICE_PROVIDERS },
  { command: 'tts', label: '--speechify-tts-voice-gender', values: SPEECHIFY_CUSTOM_VOICE_GENDERS },
  { command: 'music', label: '--model', values: SUPPORTED_WHISPER_MODELS }
] as const

test('every derived help list documents each value its validator accepts', async () => {
  const helpByCommand = new Map<string, string>()
  for (const command of [...new Set(derivedHelpLists.map((entry) => entry.command))]) {
    const result = await runCommand(['src/cli/create-cli.ts', command, '--help'], { env: helpEnv })
    expect(result.exitCode).toBe(0)
    helpByCommand.set(command, result.stdout)
  }

  const missing: string[] = []
  for (const entry of derivedHelpLists) {
    const help = helpByCommand.get(entry.command) as string
    for (const value of entry.values) {
      if (!help.includes(String(value))) {
        missing.push(`${entry.command} ${entry.label}: ${String(value)}`)
      }
    }
  }

  expect(missing).toEqual([])
})

test('global help lists are derived from the logger and runtime tool registries', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', '--help'], { env: helpEnv })

  expect(result.stdout).toContain(LOG_LEVELS.join('|'))
  expect(result.stdout).toContain(LOG_FORMAT_CHOICES.join('|'))
  for (const tool of RUNTIME_TOOL_IDS) {
    expect(result.stdout).toContain(tool)
  }
})

test('every run-producing command exposes the global deterministic output directory flag', async () => {
  const commands = ['image', 'tts', 'video', 'music', 'extract', 'write', 'download', 'metadata', 'benchmark'] as const
  for (const command of commands) {
    const result = await runCommand(['src/cli/create-cli.ts', command, '--help'], { env: helpEnv })

    expect(result.exitCode).toBe(0)
    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    expect(globalFlagsSection).toContain('--output-dir')
    expect(result.stdout).not.toMatch(/--out(?:\s|$)/)
  }

  // Commands that only read or resume an existing directory reject it instead.
  const resumeResult = await runCommand(
    ['src/cli/create-cli.ts', 'resume', 'output/does-not-exist', '--output-dir', 'output/nope'],
    { env: helpEnv }
  )
  expect(resumeResult.exitCode).not.toBe(0)
  expect(`${resumeResult.stdout}\n${resumeResult.stderr}`).toContain('--output-dir is not supported by "resume"')

  const writeResult = await runCommand(['src/cli/create-cli.ts', 'write', '--help'], { env: helpEnv })
  expect(writeResult.exitCode).toBe(0)
  expect(writeResult.stdout).toContain('Output format: text|json|tsv|hocr')
  expect(writeResult.stdout).not.toContain('Alias for --output-dir')
})

test('resume help exposes unified multi-target provider selector', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'resume', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--all-providers')
  expect(result.stdout).toContain('--all-local')
  expect(result.stdout).toContain('--provider-concurrency')
  expect(result.stdout).toContain('--local-concurrency')
  expect(result.stdout).toContain('--ocr-concurrency')
  expect(getFlagGroupSection(result.stdout, 'Batch Processing')).toContain('--batch-concurrency')
  expect(getFlagGroupSection(result.stdout, 'OCR / Document Extraction')).not.toContain('--batch-concurrency')
  expect(result.stdout).toContain('STT:')
  expect(result.stdout).toContain('OCR:')
  expect(result.stdout).toContain('TTS:')
  expect(result.stdout).toContain('image:')
  expect(result.stdout).toContain('video:')
  expect(result.stdout).toContain('music:')
  expect(result.stdout).toContain('whisper')
  expect(result.stdout).toContain('tesseract')
  expect(result.stdout).toContain('kitten')
  expect(result.stdout).toContain('bfl')
  expect(result.stdout).toContain('recraft')
  expect(result.stdout).toContain('replicate')
  expect(result.stdout).toContain('runway')
  expect(result.stdout).toContain('ltx')
})

test('comic help lists every subcommand and points at their own help', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'comic', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  const subcommandSection = getSection(result.stdout, '\nSubcommands\n', '\nGlobal Flags\n')
  for (const subcommand of comicSubcommands) {
    expect(subcommandSection).toContain(`  ${subcommand}`)
  }
  expect(subcommandSection).toContain('Run panel prompt bundles to review sketches and/or final panel images')
  expect(result.stdout).toContain('bun autoshow comic <subcommand> --help')
  // The parent lists subcommands; it must not inline their flags.
  expect(getCommandFlagsSection(result.stdout)).toBe('')
})

test('comic generate-images help is scoped to its own page and QA flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'comic', 'generate-images', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('$ bun autoshow comic generate-images <script-path> [flags]')
  expect(result.stdout).toContain('NN-SC shorthand')
  expect(result.stdout).toContain('05-01')
  expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--panels')
  expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--panels-per-image')
  expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--grid')
  expect(getFlagGroupSection(result.stdout, 'Image Options')).toContain('--variation')
  expect(getFlagGroupSection(result.stdout, 'Image QA')).toContain('--qa, --no-qa')
  expect(getFlagGroupSection(result.stdout, 'Image QA')).toContain('--max-repairs')
  expect(result.stdout).toContain('final default: 1; sketch default: 6')
  expect(result.stdout).toContain('bun autoshow comic draft-scenes <script-path> --only panel-prompts')
  expect(result.stdout).not.toContain('[--target prompts|images|sketches|both]')
  // Other subcommands' exclusive flags must not leak into this page.
  const flagsSection = getCommandFlagsSection(result.stdout)
  expect(flagsSection).not.toContain('--only')
  expect(flagsSection).not.toContain('--character')
  expect(flagsSection).not.toContain('--location')
})

test('comic draft-scenes help is scoped to the drafting stages', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'comic', 'draft-scenes', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('$ bun autoshow comic draft-scenes <script-path> [flags]')
  expect(getFlagGroupSection(result.stdout, 'Scene Drafting')).toContain('--only')
  expect(result.stdout).toContain('structure|prompt|scene|panel-prompts')
  const flagsSection = getCommandFlagsSection(result.stdout)
  expect(flagsSection).not.toContain('--panels')
  expect(flagsSection).not.toContain('--target')
  expect(flagsSection).not.toContain('--character')
})

test('comic reference-sketch help documents both reference kinds', async () => {
  const reference = await runCommand(['src/cli/create-cli.ts', 'comic', 'reference-sketch', '--help'], { env: helpEnv })

  expect(reference.exitCode).toBe(0)
  expect(reference.stdout).toContain('$ bun autoshow comic reference-sketch [flags]')
  expect(getFlagGroupSection(reference.stdout, 'Reference Sheet')).toContain('--character')
  expect(getFlagGroupSection(reference.stdout, 'Reference Sheet')).toContain('--location')
  expect(reference.stdout).toContain('Exactly one of --character or --location is required')
  expect(getCommandFlagsSection(reference.stdout)).not.toContain('--panels')
})

test('comic help subcommand routing matches the --help flag output', async () => {
  const viaFlag = await runCommand(['src/cli/create-cli.ts', 'comic', 'generate-images', '--help'], { env: helpEnv })
  const viaHelp = await runCommand(['src/cli/create-cli.ts', 'comic', 'help', 'generate-images'], { env: helpEnv })

  expect(viaHelp.exitCode).toBe(0)
  expect(viaHelp.stdout).toBe(viaFlag.stdout)
})
