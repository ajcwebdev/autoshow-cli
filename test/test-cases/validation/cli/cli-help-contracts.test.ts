import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from '~/cli/command-definitions'
import { FLAG_TO_CONFIG_PATH } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { VOICE_PUBLIC_ACTIONS } from '~/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { getNativeRenderableCommands } from '~/cli/native/builtins'
import { commandAcceptsGlobalFlag, globalFlagsForCommand } from '~/cli/native/global-flag-support'
import { HELP_EXAMPLE_ALIGN_COLUMN_CAP, renderCommandHelp, renderRootHelp } from '~/cli/native/help-renderer'
import { commandCreatesRunDirectory } from '~/cli/native/run-directory-support'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { colorizeHelpDescription } from '~/cli/help-colors'
import { configureColor, stripAnsi } from '~/utils/terminal-colors'
import { runCommand } from '../../../test-utils/test-helpers'
import type { CliCommandDefinition, CliFlagsDefinition } from '~/types'
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
  GROK_VIDEO_ASPECT_RATIOS,
  LUMA_ASPECT_RATIOS,
  LUMA_RESOLUTIONS,
  REPLICATE_VIDEO_RESOLUTIONS
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { GEMINI_IMAGE_RESPONSE_MODES, GEMINI_IMAGE_SIZE_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-gemini/gemini-image-targets'
import { OPENAI_FIXED_IMAGE_SIZE_VALUES, OPENAI_IMAGE_BACKGROUND_VALUES } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-openai/openai-image-targets'
import { LUMALABS_MAX_IMAGE_INPUTS } from '~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/lumalabs-image-targets'
import { ELEVENLABS_MAX_DURATION_SECONDS, ELEVENLABS_MIN_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-elevenlabs/run-elevenlabs-music-gen'

import {
  SUPPORTED_MINIMAX_TTS_EMOTIONS,
  SUPPORTED_WHISPER_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

const helpEnv = { NO_COLOR: '1' }
const removedSetupCommand = ['so', 'ck'].join('')
for (const command of COMMAND_DEFINITIONS) {
  const group = HELP_COMMAND_GROUP_BY_NAME[command.name]
  if (group !== undefined) {
    command.help = { ...command.help, group }
  }
}
const nativeRoot = createNativeRootDefinition()
const renderableCommands = getNativeRenderableCommands(COMMAND_DEFINITIONS)
const flattenCommands = (commands: readonly { name: string, subcommands?: readonly CliCommandDefinition[] }[]): CliCommandDefinition[] =>
  commands.flatMap((command) => [command as CliCommandDefinition, ...flattenCommands(command.subcommands ?? [])])
const helpSurfaces = flattenCommands(renderableCommands)
const comicCommand = COMMAND_DEFINITIONS.find((command) => command.name === 'comic')
if (comicCommand === undefined) throw new Error('comic command is not registered')
const comicSubcommands = (comicCommand.subcommands ?? []).map((subcommand) =>
  subcommand.name.startsWith('comic ') ? subcommand.name.slice('comic '.length) : subcommand.name
)
const helpArgv = (commandName: string): string[] => [...commandName.split(' '), '--help']
const advertisedFlagNames = (section: string): string[] =>
  section.split('\n').flatMap((line) => {
    const match = line.match(/^ {2,4}--([a-z0-9-]+)/)
    return match?.[1] === undefined ? [] : [match[1]]
  })
const visibleFlagNames = (flags: CliFlagsDefinition | undefined): string[] =>
  Object.entries(flags ?? {})
    .filter(([, definition]) => definition.help?.hidden !== true)
    .map(([name]) => name)
    .sort()
const persistedVideoInputFlags = [
  'video-input-image',
  'video-last-frame',
  'video-reference-image',
  'video-input-video'
] as const
const HELP_TREE_TIMEOUT_MS = 30_000
type HelpResult = { exitCode: number, stdout: string, stderr: string }
const findHelpCommand = (name: string) =>
  helpSurfaces.find((command) => command.name === name)

// These contracts assert help structure, not palette. The spawned help checks
// below force NO_COLOR for the same reason; the in-process renderer honors
// FORCE_COLOR (which `bun t` sets), so strip ANSI here instead.
const loadHelp = async (args: string[]): Promise<HelpResult> => {
  if (args[0] === 'benchmark') {
    return {
      exitCode: 2,
      stdout: '',
      stderr: 'Unknown command "benchmark"'
    }
  }
  if (args.length === 1 && args[0] === '--help') {
    return { exitCode: 0, stdout: stripAnsi(renderRootHelp(nativeRoot, COMMAND_DEFINITIONS)), stderr: '' }
  }
  const withoutHelp = args.filter((arg) => arg !== '--help')
  const commandName = withoutHelp[0] === 'comic' && withoutHelp[1] === 'help' && withoutHelp[2]
    ? `comic ${withoutHelp[2]}`
    : withoutHelp.join(' ')
  const command = findHelpCommand(commandName)
  if (!command) {
    return { exitCode: 2, stdout: '', stderr: `Unknown command "${commandName}"` }
  }
  return { exitCode: 0, stdout: stripAnsi(renderCommandHelp(nativeRoot, command)), stderr: '' }
}

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

test.concurrent('root help groups setup utilities separately from processing commands', async () => {
  const result = await loadHelp(['--help'])

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

test.concurrent('every registered command and subcommand renders help with its public usage', async () => {
  expect(helpSurfaces.map((command) => command.name)).toEqual(
    expect.arrayContaining(comicSubcommands.map((subcommand) => `comic ${subcommand}`))
  )

  for (const command of helpSurfaces) {
    const result = await loadHelp(helpArgv(command.name))
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`$ bun autoshow ${command.name}`)
  }

  const links = await loadHelp(['links', '--help'])
  const video = await loadHelp(['video', '--help'])
  const help = await loadHelp(['help', '--help'])
  expect(links.stdout).toContain('$ bun autoshow links [selection...] [flags]')
  expect(video.stdout).toContain('$ bun autoshow video <input> [flags]')
  expect(help.stdout).toContain('$ bun autoshow help [command] [flags]')
  expect(help.stdout).not.toContain('[command...]')
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('links help includes models selector example', async () => {
  const result = await loadHelp(['links', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('bun autoshow links models')
  expect(result.stdout).toContain('Fetch model documentation across every provider')
  expect(result.stdout).toContain('--refresh')
  expect(result.stdout).toContain('Write refresh metadata sidecar')
})

test.concurrent('metadata help groups document, output, article, and batch flags', async () => {
  const result = await loadHelp(['metadata', '--help'])

  expect(result.exitCode).toBe(0)
  expect(getFlagGroupSection(result.stdout, 'Document Options')).toContain('--password')
  expect(getFlagGroupSection(result.stdout, 'Metadata Output')).toContain('--markdown')
  expect(getFlagGroupSection(result.stdout, 'Metadata Output')).toContain('--save')
  expect(getFlagGroupSection(result.stdout, 'Article Extraction')).toContain('--url-provider')
  expect(getFlagGroupSection(result.stdout, 'Batch Processing')).toContain('--batch-limit')
})

test.concurrent('extract help exposes shared batch and all-provider flags', async () => {
  const result = await loadHelp(['extract', '--help'])

  expect(result.exitCode).toBe(0)
  const providerSection = getFlagGroupSection(result.stdout, 'Provider Selection')
  const transcriptionSection = getFlagGroupSection(result.stdout, 'Transcription / STT')
  const documentSection = getFlagGroupSection(result.stdout, 'OCR / Document Extraction')
  const articleSection = getFlagGroupSection(result.stdout, 'Article Extraction')
  const batchSection = getFlagGroupSection(result.stdout, 'Batch Processing')
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
  expect(documentSection).toContain('--ocr-provider-mode')
  expect(documentSection).toContain('fanout|pool')
  expect(documentSection).toContain('Local OCR defaults to 10')
  expect(documentSection).toContain('hosted OCR defaults to auto')
  expect(documentSection).toContain('--chapters')
  expect(documentSection).toContain('--no-chapters')
  expect(articleSection).not.toContain('--url-request-timeout-ms')
  expect(articleSection).not.toContain('--url-request-attempts')
  expect(batchSection).toContain('--batch-limit')
  expect(transcriptVideoSection).toContain('--transcript-video')
  expect(transcriptVideoSection).toContain('--transcript-result')
  expect(transcriptVideoSection).toContain('--transcript-text')
  expect(pricingSection).toContain('--price')
  expect(result.stdout).toContain('--batch-limit')
  expect(result.stdout).not.toContain('--batch-all')
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
  expect(result.stdout).not.toContain('--url-request-timeout-ms')
  expect(result.stdout).not.toContain('--url-request-attempts')
  expect(result.stdout).not.toContain('--stt-preflight-concurrency')
  expect(result.stdout).toContain('--transcript-video')
  expect(result.stdout).toContain('--transcript-result')
  expect(result.stdout).toContain('--transcript-text')
})

test.concurrent('download help exposes media preservation flags', async () => {
  const result = await loadHelp(['download', '--help'])

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

test.concurrent('tts help exposes hosted TTS provider flags', async () => {
  const result = await loadHelp(['tts', '--help'])

  expect(result.exitCode).toBe(0)
  expect(getFlagGroupSection(result.stdout, 'Provider Selection')).toContain('--provider')
  expect(getFlagGroupSection(result.stdout, 'Provider Selection')).toContain('--provider-concurrency')
  expect(getFlagGroupSection(result.stdout, 'Text to Speech')).toContain('--tts-voice')
  expect(getFlagGroupSection(result.stdout, 'Text to Speech')).toContain('--tts-chunk-concurrency')
  expect(getFlagGroupSection(result.stdout, 'Batch Processing')).toContain('--batch-concurrency')
  expect(getFlagGroupSection(result.stdout, 'MiniMax TTS')).toContain('--minimax-tts-volume')
  expect(result.stdout).not.toContain('Deepgram TTS')
  expect(result.stdout).not.toContain('Speechify TTS')
  expect(result.stdout).not.toContain('Hume TTS')
  expect(getFlagGroupSection(result.stdout, 'Multi-Speaker / Dialogue')).toContain('--tts-dialogue-format')
  expect(getFlagGroupSection(result.stdout, 'ElevenLabs TTS')).toContain('--elevenlabs-tts-stability')
  expect(getFlagGroupSection(result.stdout, 'Pricing')).toContain('--price')
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--all-providers')
  expect(result.stdout).not.toContain('--all-local')
  expect(result.stdout).toContain('--provider-concurrency')
  expect(result.stdout).not.toContain('--local-concurrency')
  expect(result.stdout).toContain('--tts-voice')
  expect(result.stdout).toContain('--tts-speed')
  expect(result.stdout).toContain('--tts-language')
  expect(result.stdout).toContain('--tts-ref-audio')
  expect(result.stdout).not.toContain('--tts-voice-name')
  expect(result.stdout).not.toContain('--tts-consent-audio')
  expect(result.stdout).not.toContain('--tts-consent-language')
  expect(result.stdout).not.toContain('--tts-consent-name')
  expect(result.stdout).toContain('--allow-ambiguous-redispatch')
  expect(result.stdout).not.toContain('--tts-allow-ambiguous-redispatch')
  expect(result.stdout).toContain('--tts-text-normalization')
  expect(result.stdout).toContain('--tts-instructions')
  expect(result.stdout).not.toContain('--tts-output-format')
  expect(result.stdout).toContain('--tts-chunk-concurrency')
  expect(result.stdout).toContain('Grok-only uses 50')
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
  expect(result.stdout).not.toContain('--deepgram-tts-container')
  expect(result.stdout).not.toContain('--deepgram-tts-bit-rate')
  expect(result.stdout).not.toContain('--deepgram-tts-sample-rate')
  expect(result.stdout).not.toContain('--deepgram-tts-speed')
  expect(result.stdout).not.toContain('--minimax-tts-voice')
  expect(result.stdout).not.toContain('--minimax-tts-ref-audio')
  expect(result.stdout).not.toContain('--minimax-tts-prompt-audio')
  expect(result.stdout).not.toContain('--minimax-tts-prompt-text')
  expect(result.stdout).not.toContain('--minimax-tts-clone-noise-reduction')
  expect(result.stdout).not.toContain('--minimax-tts-clone-volume-normalization')
  expect(result.stdout).not.toContain('--minimax-tts-language-boost')
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
  expect(result.stdout).not.toContain('--speechify-tts-voice-locale')
  expect(result.stdout).not.toContain('--speechify-tts-voice-gender')
  expect(result.stdout).not.toContain('--hume-tts  ')
  expect(result.stdout).not.toContain('--hume-tts-voice-provider')
  expect(result.stdout).not.toContain('--cartesia-tts  ')
  expect(result.stdout).not.toContain('--cartesia-tts-voice')
  expect(result.stdout).not.toContain('--cartesia-tts-language')
  expect(result.stdout).not.toContain('--elevenlabs-tts-output-format')
  expect(result.stdout).not.toContain('--elevenlabs-tts-language-code')
  expect(result.stdout).not.toContain('--elevenlabs-tts-clone-remove-background-noise')
  expect(result.stdout).toContain('--elevenlabs-tts-stability')
  expect(result.stdout).toContain('--elevenlabs-tts-similarity-boost')
  expect(result.stdout).toContain('--elevenlabs-tts-style')
  expect(result.stdout).toContain('--elevenlabs-tts-use-speaker-boost')
  expect(result.stdout).not.toContain('--elevenlabs-tts-speed')
  expect(result.stdout).toContain('--elevenlabs-tts-seed')
  expect(result.stdout).not.toContain('--elevenlabs-tts-text-normalization')
  expect(result.stdout).toContain('--elevenlabs-tts-pronunciation-dictionary-locator')
  expect(result.stdout).not.toContain('--elevenlabs-tts-optimize-streaming-latency')
})

test.concurrent('write and config help expose shared selectors and concurrency flags', async () => {
  const writeResult = await loadHelp(['write', '--help'])
  const configResult = await loadHelp(['config', '--help'])

  expect(writeResult.exitCode).toBe(0)
  expect(configResult.exitCode).toBe(0)
  const pipelineSection = getFlagGroupSection(writeResult.stdout, 'Pipeline Selection')
  expect(pipelineSection).toContain('--provider-concurrency')
  expect(pipelineSection).toContain('--local-concurrency')
  expect(pipelineSection).toContain('--concurrency-mode')
  expect(pipelineSection).toContain('--all-providers')
  expect(pipelineSection).toContain('--all-local')
  expect(pipelineSection).toContain('--llm')
  expect(getFlagGroupSection(writeResult.stdout, 'Batch / Download')).toContain('--batch-limit')
  expect(getFlagGroupSection(configResult.stdout, 'Concurrency')).toContain('--provider-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Concurrency')).toContain('--local-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Concurrency')).toContain('--concurrency-mode')
  expect(getFlagGroupSection(configResult.stdout, 'Batch / Download')).toContain('--batch-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Pricing')).not.toContain('--provider-concurrency')
  expect(getFlagGroupSection(configResult.stdout, 'Pricing')).not.toContain('--local-concurrency')
  expect(getFlagGroupSection(writeResult.stdout, 'Transcription / STT')).toContain('--youtube-captions')
  expect(getFlagGroupSection(writeResult.stdout, 'OCR / Document Extraction')).toContain('--ocr-language')
  expect(getFlagGroupSection(writeResult.stdout, 'OCR / Document Extraction')).toContain('--ocr-concurrency')
  expect(getFlagGroupSection(writeResult.stdout, 'OCR / Document Extraction')).toContain('--ocr-provider-mode')
  expect(getFlagGroupSection(writeResult.stdout, 'OCR / Document Extraction')).toContain('Local OCR defaults to 10')
  expect(getFlagGroupSection(writeResult.stdout, 'Article Extraction')).toContain('--url-provider')
  expect(getFlagGroupSection(writeResult.stdout, 'Writing')).toContain('--prompt')
  expect(getFlagGroupSection(writeResult.stdout, 'Text to Speech')).toContain('--tts-voice')
  expect(getFlagGroupSection(writeResult.stdout, 'Text to Speech')).toContain('--tts-chunk-concurrency')
  expect(getFlagGroupSection(writeResult.stdout, 'Image Options')).toContain('--image-aspect-ratio')
  expect(getFlagGroupSection(writeResult.stdout, 'Video Options')).toContain('--video-mode')
  expect(getFlagGroupSection(writeResult.stdout, 'Hosted Music')).toContain('--music-duration')
  expect(getFlagGroupSection(configResult.stdout, 'Transcription / STT')).toContain('--stt')
  expect(getFlagGroupSection(configResult.stdout, 'OCR / Document Extraction')).toContain('--ocr')
  expect(getFlagGroupSection(configResult.stdout, 'Writing')).toContain('--llm')
  expect(getFlagGroupSection(configResult.stdout, 'Text to Speech')).toContain('--tts')
  expect(getFlagGroupSection(configResult.stdout, 'Image Options')).toContain('--image')
  expect(getFlagGroupSection(configResult.stdout, 'Video Options')).toContain('--video')
  expect(getFlagGroupSection(configResult.stdout, 'Hosted Music')).toContain('--music')

  const musicStart = writeResult.stdout.indexOf('\n  Hosted Music\n')
  expect(musicStart).toBeGreaterThanOrEqual(0)
  const globalFlagsStart = writeResult.stdout.indexOf('\nGlobal Flags\n', musicStart)
  expect(globalFlagsStart).toBeGreaterThan(musicStart)
  const afterStep7BeforeGlobal = writeResult.stdout.slice(musicStart, globalFlagsStart)
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
  expect(writeResult.stdout).toContain('gemini|openai|grok|bfl|replicate')
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
  expect(configResult.stdout).toContain('gemini|openai|grok|bfl|replicate')
  expect(configResult.stdout).toContain('--tts-chunk-concurrency')
  expect(writeResult.stdout).toContain('Grok-only uses 50')
  expect(configResult.stdout).toContain('Grok-only uses 50')
  expect(configResult.stdout).toContain('--ocr-concurrency')
  expect(configResult.stdout).toContain('--ocr-provider-mode')
  expect(configResult.stdout).toContain('--music-instrumental')
  expect(configResult.stdout).not.toContain('--music-lyrics-file')
  expect(configResult.stdout).not.toContain('--prompt-md')
  expect(configResult.stdout).not.toContain('--allow-ambiguous-redispatch')
  expect(configResult.stdout).not.toContain('--tts-allow-ambiguous-redispatch')
  expect(configResult.stdout).not.toContain('--llm-provider-concurrency')
  expect(configResult.stdout).not.toContain('--mistral-stt')
  expect(configResult.stdout).not.toContain('openai=gpt-5.4 --stt')
})

test.concurrent('music help includes hosted generation and lyric-video flags', async () => {
  const result = await loadHelp(['music', '--help'])

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
  expect(result.stdout).not.toContain('--input-dir')
  expect(result.stdout).not.toContain('--keep-tmp')
  expect(result.stdout).not.toContain('--openai')
  expect(result.stdout).not.toContain('--prompt')
  expect(result.stdout).not.toContain('--prompt-file')
  expect(result.stdout).not.toContain('--track-list')
})

test.concurrent('image and video help expose generic provider selection plus their own option groups', async () => {
  const imageResult = await loadHelp(['image', '--help'])
  const videoResult = await loadHelp(['video', '--help'])

  expect(imageResult.exitCode).toBe(0)
  expect(videoResult.exitCode).toBe(0)
  expect(getFlagGroupSection(imageResult.stdout, 'Provider Selection')).toContain('--provider')
  expect(getFlagGroupSection(imageResult.stdout, 'Image Options')).toContain('--aspect-ratio')
  expect(getFlagGroupSection(imageResult.stdout, 'Image Inputs')).toContain('--input')
  expect(getFlagGroupSection(imageResult.stdout, 'Provider-Specific Image Options')).toContain('--compression')
  expect(getFlagGroupSection(imageResult.stdout, 'Pricing')).toContain('--price')
  expect(getFlagGroupSection(videoResult.stdout, 'Provider Selection')).toContain('--provider')
  expect(getFlagGroupSection(videoResult.stdout, 'Video Options')).toContain('--mode')
  expect(getFlagGroupSection(videoResult.stdout, 'Video Options')).toContain('--generate-audio')
  expect(getFlagGroupSection(videoResult.stdout, 'Video Inputs')).toContain('--input-image')
  expect(getFlagGroupSection(videoResult.stdout, 'Video Inputs')).toContain('--reference-video')
  expect(getFlagGroupSection(videoResult.stdout, 'Video Inputs')).toContain('--reference-audio')
  expect(getFlagGroupSection(videoResult.stdout, 'Replicate Video')).toContain('--replicate-video-seed')
  expect(videoResult.stdout).not.toContain('fal.ai Video')
  expect(getFlagGroupSection(videoResult.stdout, 'Pricing')).toContain('--price')
  expect(imageResult.stdout).toContain('gpt-image-2')
  expect(imageResult.stdout).toContain('replicate')
  expect(imageResult.stdout).toContain('wan-video/wan-2.7-image')
  expect(videoResult.stdout).toContain('ltx')
  expect(videoResult.stdout).toContain('ltx-2-3-fast')
  expect(videoResult.stdout).not.toContain('wan-video/wan-2.7-t2v')
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
  expect(videoResult.stdout).not.toContain('--size')
  expect(videoResult.stdout).not.toContain('--video-size')
  expect(videoResult.stdout).not.toContain('--video-mode')
  expect(videoResult.stdout).not.toContain('--video-input-image')
  expect(videoResult.stdout).not.toContain('--video-resolution')
  expect(videoResult.stdout).not.toContain('--video-aspect-ratio')
  expect(videoResult.stdout).toContain('Luma Labs')
  expect(videoResult.stdout).toContain('540p|720p|1080p')
  expect(videoResult.stdout).toContain('21:9|9:21|adaptive')
  expect(videoResult.stdout).not.toContain('--grok-video-storage-filename')
  expect(videoResult.stdout).not.toContain('--grok-video-storage-expires-after')
})

test.concurrent('provider help lists are derived from the supported selector registries', async () => {
  const [extract, write, config, resume, tts] = await Promise.all([
    loadHelp(['extract', '--help']),
    loadHelp(['write', '--help']),
    loadHelp(['config', '--help']),
    loadHelp(['resume', '--help']),
    loadHelp(['tts', '--help'])
  ])

  const urlBackends = URL_ARTICLE_BACKENDS.join('|')
  const llmProviders = Object.keys(WRITE_LLM_PROVIDER_TARGETS).join('|')
  const videoProviders = Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS).join('|')

  expect(extract.stdout).toContain('whisperfile')
  expect(extract.stdout).toContain(urlBackends)
  expect(write.stdout).toContain(llmProviders)
  expect(write.stdout).toContain('(default: cheapest hosted)')
  expect(write.stdout).toMatch(/--stt[^\n]*whisperfile/)
  expect(config.stdout).toContain(llmProviders)
  expect(config.stdout).toContain('(default: cheapest hosted)')
  expect(config.stdout).toMatch(/--stt[^\n]*whisperfile/)
  expect(resume.stdout).toContain(`URL: ${urlBackends}`)
  expect(resume.stdout).toContain(`video: ${videoProviders}`)
  expect(resume.stdout).toContain('(default: cheapest hosted)')
  expect(tts.stdout).toContain('repeatable (default: cheapest hosted)')
})

test.concurrent('Luma, ratio, and music duration descriptions match supported behavior', async () => {
  const image = await loadHelp(['image', '--help'])
  const music = await loadHelp(['music', '--help'])

  // Seedream's odd-one-out ratio is match_input_image; `adaptive` belongs to Seedance video.
  expect(image.stdout).toContain('Replicate Seedream also supports match_input_image')
  expect(image.stdout).not.toContain('Replicate Seedream also supports adaptive')
  expect(image.stdout).toContain(`Luma Labs supports up to ${LUMALABS_MAX_IMAGE_INPUTS}`)
  expect(music.stdout).toContain(`ElevenLabs configurable from ${ELEVENLABS_MIN_DURATION_SECONDS}-${ELEVENLABS_MAX_DURATION_SECONDS}`)
  expect(music.stdout).not.toContain('MiniMax currently ignores this flag')
  expect(music.stdout).not.toContain('Gemini Lyria Clip is fixed')
  expect(music.stdout).toContain('Gemini Lyria Pro uses the requested duration')
  expect(image.stdout).toContain('(default: 1)')
})

test.concurrent('--replicate-video-multi-prompt description dynamically adapts to command surface', async () => {
  const video = await loadHelp(['video', '--help'])
  const write = await loadHelp(['write', '--help'])

  expect(video.stdout).toContain('durations sum to --duration)')
  expect(video.stdout).not.toContain('durations sum to --video-duration)')

  expect(write.stdout).toContain('durations sum to --video-duration)')
  expect(write.stdout).not.toContain('durations sum to --duration)')
})

// Each entry pins one help description to the constant its validator uses, so adding a
// supported value without documenting it fails here instead of shipping a stale list.
const derivedHelpLists = [
  { command: 'video', label: '--video-mode', values: VIDEO_MODES },
  { command: 'video', label: '--video-aspect-ratio (Luma Labs)', values: LUMA_ASPECT_RATIOS },
  { command: 'video', label: '--video-aspect-ratio (Grok)', values: GROK_VIDEO_ASPECT_RATIOS },
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
  { command: 'tts', label: '--minimax-tts-emotion', values: SUPPORTED_MINIMAX_TTS_EMOTIONS },
  { command: 'music', label: '--model', values: SUPPORTED_WHISPER_MODELS }
] as const

test.concurrent('every derived help list documents each value its validator accepts', async () => {
  const helpByCommand = new Map<string, string>()
  for (const command of [...new Set(derivedHelpLists.map((entry) => entry.command))]) {
    const result = await loadHelp([command, '--help'])
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

test.concurrent('global help lists are derived from the logger and runtime tool registries', async () => {
  const result = await loadHelp(['--help'])

  expect(result.stdout).toContain(LOG_LEVELS.join('|'))
  expect(result.stdout).toContain(LOG_FORMAT_CHOICES.join('|'))
  for (const tool of RUNTIME_TOOL_IDS) {
    expect(result.stdout).toContain(tool)
  }
})

test.concurrent('every run-producing command exposes the global deterministic output directory flag', async () => {
  for (const command of helpSurfaces.filter((entry) => commandCreatesRunDirectory(entry.name))) {
    const result = await loadHelp(helpArgv(command.name))

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

  const writeResult = await loadHelp(['write', '--help'])
  expect(writeResult.exitCode).toBe(0)
  expect(writeResult.stdout).toContain('Output format: text|json')
  expect(writeResult.stdout).not.toContain('Alias for --output-dir')
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('resume help exposes unified multi-target provider selector', async () => {
  const result = await loadHelp(['resume', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--all-providers')
  expect(result.stdout).toContain('--all-local')
  expect(result.stdout).toContain('--provider-concurrency')
  expect(result.stdout).toContain('--local-concurrency')
  expect(result.stdout).toContain('--ocr-concurrency')
  expect(getFlagGroupSection(result.stdout, 'Batch Processing')).toContain('--batch-concurrency')
  expect(getFlagGroupSection(result.stdout, 'Transcription / STT')).toContain('--youtube-captions')
  expect(getFlagGroupSection(result.stdout, 'OCR / Document Extraction')).not.toContain('--batch-concurrency')
  expect(getFlagGroupSection(result.stdout, 'Text to Speech')).toContain('--tts-voice')
  expect(getFlagGroupSection(result.stdout, 'Image Options')).toContain('--image-aspect-ratio')
  expect(getFlagGroupSection(result.stdout, 'Hosted Music')).toContain('--music-duration')
  expect(result.stdout).toContain('STT:')
  expect(result.stdout).toContain('OCR:')
  expect(result.stdout).toContain('TTS:')
  expect(result.stdout).toContain('image:')
  expect(result.stdout).toContain('video:')
  expect(result.stdout).toContain('music:')
  expect(result.stdout).toContain('whisper')
  expect(result.stdout).toContain('tesseract')
  expect(result.stdout).toContain('bfl')
  expect(result.stdout).not.toContain('recraft')
  expect(result.stdout).toContain('replicate')
  expect(result.stdout).not.toContain('runway')
  expect(result.stdout).toContain('ltx')
})

test.concurrent('comic help lists every subcommand and points at their own help', async () => {
  const result = await loadHelp(['comic', '--help'])

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

test.concurrent('comic generate-images help is scoped to its own page and QA flags', async () => {
  const result = await loadHelp(['comic', 'generate-images', '--help'])

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

test.concurrent('comic draft-scenes help is scoped to the drafting stages', async () => {
  const result = await loadHelp(['comic', 'draft-scenes', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('$ bun autoshow comic draft-scenes <script-path> [flags]')
  expect(getFlagGroupSection(result.stdout, 'Scene Drafting')).toContain('--only')
  expect(result.stdout).toContain('structure|prompt|scene|panel-prompts')
  const flagsSection = getCommandFlagsSection(result.stdout)
  expect(flagsSection).not.toContain('--panels')
  expect(flagsSection).not.toContain('--target')
  expect(flagsSection).not.toContain('--character')
})

test.concurrent('comic generate-slideshow help documents its local synchronization contract', async () => {
  const result = await loadHelp(['comic', 'generate-slideshow', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('$ bun autoshow comic generate-slideshow <script-path> [flags]')
  const presentation = getFlagGroupSection(result.stdout, 'Comic Presentation')
  expect(presentation).toContain('--audio-target')
  expect(presentation).toContain('--untimed-panel-ms')
  expect(presentation).toContain('--fps')
  expect(getFlagGroupSection(result.stdout, 'Pricing')).toContain('--price')
  expect(result.stdout).toContain('panels/panel-NN.png')
  expect(result.stdout).toContain('hard cuts only')
  expect(getCommandFlagsSection(result.stdout)).not.toContain('--provider')
})

test.concurrent('comic reference-sketch help documents both reference kinds', async () => {
  const reference = await loadHelp(['comic', 'reference-sketch', '--help'])

  expect(reference.exitCode).toBe(0)
  expect(reference.stdout).toContain('$ bun autoshow comic reference-sketch [flags]')
  expect(getFlagGroupSection(reference.stdout, 'Reference Sheet')).toContain('--character')
  expect(getFlagGroupSection(reference.stdout, 'Reference Sheet')).toContain('--location')
  expect(reference.stdout).toContain('Exactly one of --character or --location is required')
  expect(getCommandFlagsSection(reference.stdout)).not.toContain('--panels')
})

test.concurrent('comic help subcommand routing matches the --help flag output', async () => {
  const viaFlag = await loadHelp(['comic', 'generate-images', '--help'])
  const viaHelp = await loadHelp(['comic', 'help', 'generate-images'])

  expect(viaHelp.exitCode).toBe(0)
  expect(viaHelp.stdout).toBe(viaFlag.stdout)
})

test.concurrent('config help shows --max-cents and omits runtime-only --price', async () => {
  const result = await loadHelp(['config', '--help'])

  expect(result.exitCode).toBe(0)
  const pricing = getFlagGroupSection(result.stdout, 'Pricing')
  expect(pricing).toContain('--max-cents')
  expect(pricing).not.toContain('--price')
  expect(getCommandFlagsSection(result.stdout)).not.toContain('--price')
})

test.concurrent('config, resume, and write help omit the empty prompt parser default', async () => {
  for (const command of ['config', 'resume', 'write'] as const) {
    const result = await loadHelp([command, '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('(default: "default")')
    expect(result.stdout).not.toContain('[default: []]')
  }
})

test.concurrent('off-by-default boolean flags do not render [default: false] in help output', async () => {
  const root = await loadHelp(['--help'])
  expect(root.exitCode).toBe(0)
  expect(root.stdout).not.toContain('[default: false]')

  for (const command of helpSurfaces) {
    const result = await loadHelp(helpArgv(command.name))
    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('[default: false]')
  }
})

test('colorizeHelpDescription paints prose default values with terminal colors when enabled', () => {
  try {
    configureColor('force')
    const colorized = colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)')
    expect(colorized).toContain('\x1b[')
    expect(stripAnsi(colorized)).toBe('Path to config file (default: config/autoshow.json in project root)')

    configureColor('disable')
    const uncolored = colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)')
    expect(uncolored).not.toContain('\x1b[')
    expect(uncolored).toBe('Path to config file (default: config/autoshow.json in project root)')
  } finally {
    configureColor('disable')
  }
})

test.concurrent('config examples use the canonical bun autoshow prefix', async () => {
  const result = await loadHelp(['config', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('bun autoshow config --show')
  expect(result.stdout).toContain('bun autoshow config --llm openai=gpt-5.4-mini --stt whisper=base')
  expect(result.stdout).toContain('bun autoshow config --reset')
  expect(result.stdout).not.toContain('bun as config')
})

test.concurrent('root help uses imperative version wording', async () => {
  const result = await loadHelp(['--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('Print current version')
  expect(result.stdout).not.toContain('Prints current version')
})

test.concurrent('comic generate-audio help shows --slideshow and hides the --panel-video alias', async () => {
  const result = await loadHelp(['comic', 'generate-audio', '--help'])

  expect(result.exitCode).toBe(0)
  const flags = getCommandFlagsSection(result.stdout)
  expect(flags).toContain('--slideshow')
  expect(flags).not.toContain('--panel-video')
  expect(flags).not.toContain('--local-concurrency')
})

test.concurrent('comic reference-voice help lists public children without a flag wall', async () => {
  const result = await loadHelp(['comic', 'reference-voice', '--help'])

  expect(result.exitCode).toBe(0)
  expect(VOICE_PUBLIC_ACTIONS).toContain('clone')
  expect(VOICE_PUBLIC_ACTIONS).toContain('list')
  expect(VOICE_PUBLIC_ACTIONS).not.toContain('status')
  expect(VOICE_PUBLIC_ACTIONS).not.toContain('inspect')
  expect(VOICE_PUBLIC_ACTIONS).not.toContain('discover')
  expect(VOICE_PUBLIC_ACTIONS).not.toContain('revoke-consent')
  expect(VOICE_PUBLIC_ACTIONS).not.toContain('revoke')
  expect(VOICE_PUBLIC_ACTIONS).not.toContain('materialize')
  expect(VOICE_PUBLIC_ACTIONS).not.toContain('reconcile')
  const children = getSection(result.stdout, '\nSubcommands\n', '\nGlobal Flags\n')
  for (const action of VOICE_PUBLIC_ACTIONS) {
    expect(children).toContain(`  ${action}`)
  }
  expect(children).not.toMatch(/(^|\n) {2}status {2}/)
  expect(children).not.toMatch(/(^|\n) {2}materialize {2}/)
  const flags = getCommandFlagsSection(result.stdout)
  expect(flags).not.toContain('--sample')
  expect(flags).not.toContain('--allow')

  for (const action of VOICE_PUBLIC_ACTIONS) {
    const voiceHelp = await loadHelp(['voice', action, '--help'])
    const comicHelp = await loadHelp(['comic', 'reference-voice', action, '--help'])
    expect(advertisedFlagNames(getCommandFlagsSection(comicHelp.stdout))).toEqual(
      advertisedFlagNames(getCommandFlagsSection(voiceHelp.stdout))
    )
  }
})

test.concurrent('voice clone help does not advertise --kind', async () => {
  const result = await loadHelp(['voice', 'clone', '--help'])
  expect(result.exitCode).toBe(0)
  expect(getCommandFlagsSection(result.stdout)).not.toContain('--kind')
})

test.concurrent('subcommand parents render a subcommand usage placeholder', async () => {
  const voice = await loadHelp(['voice', '--help'])
  const comic = await loadHelp(['comic', '--help'])

  expect(voice.exitCode).toBe(0)
  expect(comic.exitCode).toBe(0)
  expect(voice.stdout).toContain('$ bun autoshow voice <subcommand> [flags]')
  expect(comic.stdout).toContain('$ bun autoshow comic <subcommand> [flags]')
  expect(voice.stdout).toContain('bun autoshow voice <subcommand> --help')
  expect(comic.stdout).toContain('bun autoshow comic <subcommand> --help')
  const voiceSubcommands = getSection(voice.stdout, '\nSubcommands\n', '\nGlobal Flags\n')
  for (const action of VOICE_PUBLIC_ACTIONS) {
    expect(voiceSubcommands).toContain(`  ${action}`)
  }
  expect(voiceSubcommands).not.toMatch(/(^|\n) {2}status {2}/)
  expect(voiceSubcommands).not.toMatch(/(^|\n) {2}inspect {2}/)
  expect(voiceSubcommands).not.toMatch(/(^|\n) {2}discover {2}/)
  expect(voiceSubcommands).not.toMatch(/(^|\n) {2}revoke-consent {2}/)
  expect(voiceSubcommands).not.toMatch(/(^|\n) {2}revoke {2}/)
  expect(voiceSubcommands).not.toMatch(/(^|\n) {2}materialize {2}/)
  expect(voiceSubcommands).not.toMatch(/(^|\n) {2}reconcile {2}/)

  const tts = await loadHelp(['tts', '--help'])
  const generateImages = await loadHelp(['comic', 'generate-images', '--help'])
  expect(tts.stdout).toContain('$ bun autoshow tts <input> [flags]')
  expect(generateImages.stdout).toContain('$ bun autoshow comic generate-images <script-path> [flags]')
  expect(tts.stdout).not.toContain('<subcommand>')
  expect(generateImages.stdout).not.toContain('<subcommand>')
})

test.concurrent('help output has no whitespace-only lines and caps wide example columns', async () => {
  const surfaces: string[][] = [
    ['--help'],
    ...helpSurfaces.map((command) => helpArgv(command.name))
  ]

  for (const args of surfaces) {
    const result = await loadHelp(args)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.split('\n').filter((line) => line.length > 0 && line.trim() === '')).toEqual([])
  }

  const voice = await loadHelp(['voice', '--help'])
  const description = 'Register an existing ElevenLabs voice'
  const descriptionLine = voice.stdout.split('\n').find((line) => line.includes(description))
  expect(descriptionLine).toBeDefined()
  expect(descriptionLine!.indexOf(description)).toBeLessThanOrEqual(HELP_EXAMPLE_ALIGN_COLUMN_CAP)
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('command help hides --output-dir when the command cannot create a run directory', async () => {
  for (const command of helpSurfaces.filter((entry) => !commandCreatesRunDirectory(entry.name))) {
    const result = await loadHelp(helpArgv(command.name))
    expect(result.exitCode).toBe(0)
    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    expect(globalFlagsSection).toContain('--output-root')
    expect(globalFlagsSection).not.toContain('--output-dir')
  }

  for (const command of helpSurfaces.filter((entry) => commandCreatesRunDirectory(entry.name))) {
    const result = await loadHelp(helpArgv(command.name))
    expect(result.exitCode).toBe(0)
    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    expect(globalFlagsSection).toContain('--output-dir')
    expect(globalFlagsSection).toContain('--output-root')
  }

  const root = await loadHelp(['--help'])
  expect(root.stdout).toContain('--output-dir')
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('commandAcceptsGlobalFlag keeps universal flags and restricts characters-root', () => {
  expect(commandAcceptsGlobalFlag('config', 'output-root')).toBe(true)
  expect(commandAcceptsGlobalFlag('config', 'verbose')).toBe(true)
  expect(commandAcceptsGlobalFlag('config', 'bin-dir')).toBe(true)
  expect(commandAcceptsGlobalFlag('config', 'output-dir')).toBe(false)
  expect(commandAcceptsGlobalFlag('write', 'output-dir')).toBe(true)
  expect(commandAcceptsGlobalFlag('voice', 'characters-root')).toBe(true)
  expect(commandAcceptsGlobalFlag('comic', 'characters-root')).toBe(true)
  expect(commandAcceptsGlobalFlag('voice clone', 'characters-root')).toBe(true)
  expect(commandAcceptsGlobalFlag('comic draft-scenes', 'characters-root')).toBe(true)
  expect(commandAcceptsGlobalFlag('extract', 'characters-root')).toBe(false)
  expect(commandAcceptsGlobalFlag('config', 'characters-root')).toBe(false)
  expect(commandAcceptsGlobalFlag('download', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('extract', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('write', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('tts', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('image', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('video', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('music', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('comic draft-scenes', 'allow-over-budget')).toBe(true)
  expect(commandAcceptsGlobalFlag('config', 'allow-over-budget')).toBe(false)
  expect(commandAcceptsGlobalFlag('setup', 'allow-over-budget')).toBe(false)
  expect(commandAcceptsGlobalFlag('links', 'allow-over-budget')).toBe(false)
  expect(commandAcceptsGlobalFlag('voice', 'allow-over-budget')).toBe(false)
  expect(commandAcceptsGlobalFlag('voice clone', 'allow-over-budget')).toBe(false)
  expect(commandAcceptsGlobalFlag('comic reference-voice', 'allow-over-budget')).toBe(false)
})

test.concurrent('command help hides --allow-over-budget on unbudgeted commands', async () => {
  for (const command of ['download', 'extract', 'write', 'tts', 'image', 'video', 'music', 'comic draft-scenes']) {
    const result = await loadHelp(helpArgv(command))
    expect(result.exitCode).toBe(0)
    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    expect(globalFlagsSection).toContain('--allow-over-budget')
  }

  for (const command of ['config', 'setup', 'links', 'voice', 'comic reference-voice']) {
    const result = await loadHelp(helpArgv(command))
    expect(result.exitCode).toBe(0)
    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    expect(globalFlagsSection).not.toContain('--allow-over-budget')
    expect(globalFlagsSection).toContain('--output-root')
  }

  const root = await loadHelp(['--help'])
  expect(root.stdout).toContain('--allow-over-budget')
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('command help does not advertise --model-path', async () => {
  for (const command of ['write', 'resume', 'tts', 'config', 'extract', 'voice', 'comic']) {
    const result = await loadHelp(helpArgv(command))
    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('--model-path')
  }

  const root = await loadHelp(['--help'])
  expect(root.stdout).not.toContain('--model-path')
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('command help hides --characters-root outside voice and comic', async () => {
  for (const command of ['voice', 'comic', 'comic draft-scenes']) {
    const result = await loadHelp(helpArgv(command))
    expect(result.exitCode).toBe(0)
    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    expect(globalFlagsSection).toContain('--characters-root')
  }

  for (const command of ['extract', 'config', 'write']) {
    const result = await loadHelp(helpArgv(command))
    expect(result.exitCode).toBe(0)
    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    expect(globalFlagsSection).not.toContain('--characters-root')
    expect(globalFlagsSection).toContain('--output-root')
  }

  const root = await loadHelp(['--help'])
  expect(root.stdout).toContain('--characters-root')
  expect(root.stdout).toContain('--output-root')
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('cookie flags appear on config help and leave the global surface', async () => {
  const config = await loadHelp(['config', '--help'])
  expect(config.exitCode).toBe(0)
  expect(getCommandFlagsSection(config.stdout)).toContain('--cookies')
  expect(getCommandFlagsSection(config.stdout)).toContain('--cookies-from-browser')
  expect(getCommandFlagsSection(config.stdout)).toContain('Auth')

  for (const command of ['download', 'extract', 'write']) {
    const result = await loadHelp(helpArgv(command))
    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('--cookies-from-browser')
    expect(result.stdout).not.toMatch(/--cookies(?!-)/)
  }

  const root = await loadHelp(['--help'])
  expect(root.stdout).not.toContain('--cookies-from-browser')
  expect(root.stdout).not.toMatch(/--cookies(?!-)/)
  expect(root.stdout).toContain('--output-root')
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('every help page advertises exactly the flags registered for that command', async () => {
  for (const command of helpSurfaces) {
    const result = await loadHelp(helpArgv(command.name))
    expect(result.exitCode).toBe(0)
    expect(advertisedFlagNames(getCommandFlagsSection(result.stdout)).sort()).toEqual(visibleFlagNames(command.flags))

    const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
    const expectedGlobals = visibleFlagNames(globalFlagsForCommand(GLOBAL_FLAG_DEFINITIONS, command.name))
    expect(advertisedFlagNames(globalFlagsSection).sort()).toEqual(expectedGlobals)
  }
}, HELP_TREE_TIMEOUT_MS)

test.concurrent('config help keeps persisted reusable video input flags', async () => {
  const result = await loadHelp(['config', '--help'])

  expect(result.exitCode).toBe(0)
  for (const flag of persistedVideoInputFlags) {
    expect(FLAG_TO_CONFIG_PATH[flag]).toBeDefined()
    expect(getCommandFlagsSection(result.stdout)).toContain(`--${flag}`)
  }
})

test.concurrent('retained benchmark fixtures stay in place', async () => {
  const setup = await loadHelp(['setup', '--help'])
  expect(setup.stdout).not.toContain('--repeat')

  expect(existsSync(resolve('docs/benchmarks'))).toBe(true)
  expect(existsSync(resolve('.claude/skills/consensus'))).toBe(true)
  expect(existsSync(resolve('src/utils/voice-quality-scoring.ts'))).toBe(false)
})

test('CLI help spawn smoke covers exit codes and the real help tree', async () => {
  const root = await runCommand(['src/cli/create-cli.ts', '--help'], { env: helpEnv })
  expect(root.exitCode).toBe(0)
  expect(root.stdout).toContain('Extract and write content, manage voices, generate speech, images, video, and music, and build comic workflows')

  const extract = await runCommand(['src/cli/create-cli.ts', 'extract', '--help'], { env: helpEnv })
  expect(extract.exitCode).toBe(0)
  expect(extract.stdout).toContain('$ bun autoshow extract')

  const benchmark = await runCommand(['src/cli/create-cli.ts', 'benchmark', '--help'], { env: helpEnv })
  expect(benchmark.exitCode).toBe(2)
  expect(`${benchmark.stdout}\n${benchmark.stderr}`).toContain('Unknown command "benchmark"')
})
