import { describe, expect, test } from 'bun:test'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { NativeNoSuchCommandError, NativeUnknownFlagError } from '~/cli/native/native-errors'
import { parseCommandInvocation, parseNativeCli } from '~/cli/native/native-parser'
import {
  draftScenesCommandDefinition
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_VIDEO_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'

const parseRoot = (argv: string[]) =>
  parseNativeCli(argv, COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)

const commandNamed = (name: string) => {
  const command = COMMAND_DEFINITIONS.find((entry) => entry.name === name)
  if (!command) throw new Error(`missing command ${name}`)
  return command
}

const expectUnknownCommand = (argv: string[], name: string): void => {
  expect(() => parseRoot(argv)).toThrow(NativeNoSuchCommandError)
  expect(() => parseRoot(argv)).toThrow(`Unknown command "${name}"`)
}

const expectUnknownFlag = (argv: string[], flag: string): void => {
  const command = commandNamed(argv[0]!)
  expect(() => parseCommandInvocation(argv, command, GLOBAL_FLAG_DEFINITIONS)).toThrow(NativeUnknownFlagError)
  expect(() => parseCommandInvocation(argv, command, GLOBAL_FLAG_DEFINITIONS)).toThrow(`Unexpected flag: ${flag}`)
}

const removedSetupCommand = ['so', 'ck'].join('')

const UNKNOWN_COMMANDS = [
  { argv: [removedSetupCommand], name: removedSetupCommand },
  { argv: ['benchmark'], name: 'benchmark' },
  { argv: ['benchmark', '--help'], name: 'benchmark' },
  { argv: ['stt', 'https://example.com/a.mp3'], name: 'stt' },
  { argv: ['ocr', 'https://example.com/a.mp3'], name: 'ocr' }
] as const

// `stt` and `ocr` are reserved names, not retired ones. Nothing in the parser
// reserves them: they fall through the generic unknown-command path.

const UNKNOWN_FLAGS: Array<{ argv: string[], flag: string }> = [
  { argv: ['image', 'a sunset', '--imagen-count', '2'], flag: '--imagen-count' },
  { argv: ['extract', 'https://example.com/a.mp3', '--refresh-cache'], flag: '--refresh-cache' },
  { argv: ['extract', 'https://example.com/a.mp3', '--no-cache'], flag: '--no-cache' },
  { argv: ['extract', 'https://example.com/a.mp3', '--cache-dir=/tmp/x'], flag: '--cache-dir' },
  { argv: ['write', 'https://example.com/a.mp3', '--all-url'], flag: '--all-url' },
  { argv: ['write', 'https://example.com/a.mp3', '--openai', 'gpt-5.5'], flag: '--openai' },
  { argv: ['extract', 'https://example.com/article', '--url-backend', 'firecrawl'], flag: '--url-backend' },
  { argv: ['image', 'a sunset', '--openai', 'gpt-image-2'], flag: '--openai' },
  { argv: ['video', 'a sunset', '--gemini-video', 'veo-3.1-fast-generate-preview'], flag: '--gemini-video' },
  { argv: ['music', 'ambient', '--elevenlabs', 'music_v2'], flag: '--elevenlabs' },
  { argv: ['extract', 'input.pdf', '--glm-ocr', 'glm-ocr'], flag: '--glm-ocr' },
  { argv: ['extract', 'https://example.com/a.mp3', '--glm-stt', 'x'], flag: '--glm-stt' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--minimax-tts-ref-audio', 'x.mp3'], flag: '--minimax-tts-ref-audio' },
  { argv: ['image', 'a sunset', '--out', 'output/x'], flag: '--out' },
  { argv: ['image', 'a sunset', '--image-size', '1024x1024'], flag: '--image-size' },
  { argv: ['video', 'a sunset', '--video-mode', 'text'], flag: '--video-mode' },
  { argv: ['music', 'ambient', '--music-duration', '20'], flag: '--music-duration' },
  { argv: ['resume', 'output/x', '--elevenlabs-tts-stability', '0.4'], flag: '--elevenlabs-tts-stability' },
  { argv: ['resume', 'output/x', '--minimax-tts-emotion', 'happy'], flag: '--minimax-tts-emotion' },
  { argv: ['resume', 'output/x', '--replicate-video-seed', '1'], flag: '--replicate-video-seed' },
  { argv: ['video', 'a sunset', '--grok-video-storage-filename', 'clip.mp4'], flag: '--grok-video-storage-filename' },
  { argv: ['write', 'https://example.com/a.mp3', '--grok-video-storage-expires-after', '3600'], flag: '--grok-video-storage-expires-after' },
  { argv: ['config', '--grok-video-storage-filename', 'clip.mp4'], flag: '--grok-video-storage-filename' },
  { argv: ['resume', 'output/x', '--grok-video-storage-filename', 'clip.mp4'], flag: '--grok-video-storage-filename' },
  { argv: ['resume', 'output/x', '--stt-happyscribe-organization-id', 'org'], flag: '--stt-happyscribe-organization-id' },
  { argv: ['write', 'https://example.com/a.mp3', '--model-path', './m.gguf'], flag: '--model-path' },
  { argv: ['resume', 'output/x', '--model-path', './m.gguf'], flag: '--model-path' },
  { argv: ['config', '--model-path', './m.gguf'], flag: '--model-path' },
  { argv: ['extract', 'input/examples/document/1-epub.epub', '--epub-bun'], flag: '--epub-bun' },
  { argv: ['write', 'input/examples/document/1-epub.epub', '--epub-bun'], flag: '--epub-bun' },
  { argv: ['resume', 'output/x', '--epub-bun'], flag: '--epub-bun' },
  { argv: ['music', '--audio', 'input/a.mp3', '--keep-tmp'], flag: '--keep-tmp' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--speechify-tts-voice-locale', 'en-US'], flag: '--speechify-tts-voice-locale' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--speechify-tts-voice-gender', 'female'], flag: '--speechify-tts-voice-gender' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--hume-tts-voice-provider', 'CUSTOM_VOICE'], flag: '--hume-tts-voice-provider' },
  { argv: ['write', 'https://example.com/a.mp3', '--hume-tts-voice-provider', 'CUSTOM_VOICE'], flag: '--hume-tts-voice-provider' },
  { argv: ['config', '--hume-tts-voice-provider', 'CUSTOM_VOICE'], flag: '--hume-tts-voice-provider' },
  { argv: ['video', 'a sunset', '--minimax-video', 'MiniMax-Hailuo-2.3'], flag: '--minimax-video' },
  { argv: ['config', '--minimax-video', 'MiniMax-Hailuo-2.3'], flag: '--minimax-video' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--elevenlabs-tts-clone-remove-background-noise'], flag: '--elevenlabs-tts-clone-remove-background-noise' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--tts-voice-name', 'Named Voice'], flag: '--tts-voice-name' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--tts-consent-name', 'Anthony'], flag: '--tts-consent-name' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--tts-consent-email', 'a@example.com'], flag: '--tts-consent-email' },
  { argv: ['write', 'https://example.com/a.mp3', '--tts-ref-audio', 'audio.mp3'], flag: '--tts-ref-audio' },
  { argv: ['write', 'https://example.com/a.mp3', '--tts-voice-name', 'Named Voice'], flag: '--tts-voice-name' },
  { argv: ['write', 'https://example.com/a.mp3', '--tts-consent-name', 'Anthony'], flag: '--tts-consent-name' },
  { argv: ['write', 'https://example.com/a.mp3', '--tts-consent-email', 'a@example.com'], flag: '--tts-consent-email' },
  { argv: ['config', '--tts-ref-audio', 'audio.mp3'], flag: '--tts-ref-audio' },
  { argv: ['config', '--tts-voice-name', 'Named Voice'], flag: '--tts-voice-name' },
  { argv: ['config', '--tts-consent-name', 'Anthony'], flag: '--tts-consent-name' },
  { argv: ['config', '--tts-consent-email', 'a@example.com'], flag: '--tts-consent-email' },
  { argv: ['config', '--elevenlabs-tts-clone-remove-background-noise'], flag: '--elevenlabs-tts-clone-remove-background-noise' },
  { argv: ['resume', 'output/x', '--tts-ref-audio', 'audio.mp3'], flag: '--tts-ref-audio' },
  { argv: ['resume', 'output/x', '--tts-voice-name', 'Named Voice'], flag: '--tts-voice-name' },
  { argv: ['resume', 'output/x', '--tts-consent-name', 'Anthony'], flag: '--tts-consent-name' },
  { argv: ['resume', 'output/x', '--tts-consent-email', 'a@example.com'], flag: '--tts-consent-email' },
  { argv: ['video', 'a sunset', '--size', '1920x1080'], flag: '--size' },
  { argv: ['write', 'https://example.com/a.mp3', '--video-size', '1920x1080'], flag: '--video-size' },
  { argv: ['config', '--video-size', '1920x1080'], flag: '--video-size' },
  { argv: ['resume', 'output/x', '--video-size', '1920x1080'], flag: '--video-size' },
  { argv: ['metadata', 'input.txt', '--batch-all'], flag: '--batch-all' },
  { argv: ['download', 'input.txt', '--batch-all'], flag: '--batch-all' },
  { argv: ['extract', 'input.txt', '--batch-all'], flag: '--batch-all' },
  { argv: ['write', 'input.txt', '--batch-all'], flag: '--batch-all' },
  { argv: ['music', '--input-dir', 'input/music'], flag: '--input-dir' },
  { argv: ['config', '--music-lyrics-file', 'lyrics.txt'], flag: '--music-lyrics-file' },
  { argv: ['config', '--prompt-md'], flag: '--prompt-md' },
  { argv: ['config', '--allow-ambiguous-redispatch'], flag: '--allow-ambiguous-redispatch' },
  { argv: ['config', '--tts-allow-ambiguous-redispatch'], flag: '--tts-allow-ambiguous-redispatch' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--local-concurrency', '1'], flag: '--local-concurrency' },
  { argv: ['comic', 'generate-audio', 'input/scripts/example.md', '--local-concurrency', '1'], flag: '--local-concurrency' },
  { argv: ['tts', 'input/examples/tts/1-tts.md', '--minimax-tts-language-boost', 'English'], flag: '--minimax-tts-language-boost' },
  { argv: ['video', 'a sunset', '--replicate-video-generate-audio'], flag: '--replicate-video-generate-audio' },
  { argv: ['video', 'a sunset', '--replicate-video-reference-video', 'v.mp4'], flag: '--replicate-video-reference-video' },
  { argv: ['video', 'a sunset', '--replicate-video-reference-audio', 'a.mp3'], flag: '--replicate-video-reference-audio' },
  { argv: ['video', 'a sunset', '--fal-video-generate-audio'], flag: '--fal-video-generate-audio' },
  { argv: ['video', 'a sunset', '--fal-video-reference-video', 'v.mp4'], flag: '--fal-video-reference-video' },
  { argv: ['video', 'a sunset', '--fal-video-reference-audio', 'a.mp3'], flag: '--fal-video-reference-audio' },
  { argv: ['write', 'https://example.com/a.mp3', '--replicate-video-generate-audio'], flag: '--replicate-video-generate-audio' },
  { argv: ['write', 'https://example.com/a.mp3', '--fal-video-generate-audio'], flag: '--fal-video-generate-audio' },
  { argv: ['config', '--replicate-video-generate-audio'], flag: '--replicate-video-generate-audio' },
  { argv: ['config', '--fal-video-generate-audio'], flag: '--fal-video-generate-audio' }
]

describe('removed CLI spellings', () => {
  test('removed commands are not registered', () => {
    for (const { argv, name } of UNKNOWN_COMMANDS) {
      expectUnknownCommand([...argv], name)
    }
  })

  test('removed flags are unknown on their former commands', () => {
    for (const { argv, flag } of UNKNOWN_FLAGS) {
      expectUnknownFlag(argv, flag)
    }
  })

  // The provider itself is retired, so `minimax` is no longer a video selector value at all.
  // A bare selector names the surviving providers; a model-qualified one still reports the
  // retired-model replacement before the provider lookup runs.
  test('minimax is not a video provider selector', () => {
    const command = commandNamed('video')
    expect(() => parseCommandInvocation(['video', 'a sunset', '--provider', 'minimax'], command, GLOBAL_FLAG_DEFINITIONS)).not.toThrow()
    expect(() => normalizeGenericProviderSelectorFlags(
      { provider: ['minimax'] },
      new Set(['provider']),
      [{ name: 'provider', value: 'minimax', raw: '--provider minimax', known: true }],
      'provider',
      STANDALONE_VIDEO_PROVIDER_TARGETS
    )).toThrow('Unknown provider "minimax" for --provider. Expected gemini|grok|ltx|replicate|lumalabs|fal.')
  })

  test('comic subcommands reject removed option spellings', () => {
    expect(() => parseCommandInvocation(
      [draftScenesCommandDefinition.name, '--episode', 'ep02'],
      draftScenesCommandDefinition,
      GLOBAL_FLAG_DEFINITIONS
    )).toThrow('Unexpected flag: --episode')
  })
})
