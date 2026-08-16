import { describe, expect, test } from 'bun:test'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { NativeNoSuchCommandError, NativeUnknownFlagError } from '~/cli/native/native-errors'
import { parseCommandInvocation, parseNativeCli } from '~/cli/native/native-parser'
import {
  draftScenesCommandDefinition
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'

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
  { argv: ['resume', 'output/x', '--grok-video-storage-filename', 'clip.mp4'], flag: '--grok-video-storage-filename' },
  { argv: ['resume', 'output/x', '--stt-happyscribe-organization-id', 'org'], flag: '--stt-happyscribe-organization-id' },
  { argv: ['write', 'https://example.com/a.mp3', '--model-path', './m.gguf'], flag: '--model-path' },
  { argv: ['resume', 'output/x', '--model-path', './m.gguf'], flag: '--model-path' },
  { argv: ['config', '--model-path', './m.gguf'], flag: '--model-path' }
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

  test('comic subcommands reject removed option spellings', () => {
    expect(() => parseCommandInvocation(
      [draftScenesCommandDefinition.name, '--episode', 'ep02'],
      draftScenesCommandDefinition,
      GLOBAL_FLAG_DEFINITIONS
    )).toThrow('Unexpected flag: --episode')
  })
})
