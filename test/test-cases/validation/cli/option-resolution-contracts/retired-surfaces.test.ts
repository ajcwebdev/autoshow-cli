import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { NativeNoSuchCommandError } from '~/cli/native/native-errors'
import { parseCommandInvocation, parseNativeCli } from '~/cli/native/native-parser'
import { generateImagesCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { formatModelSelector } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { renderCommandHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'

const parseRoot = (argv: string[]) =>
  parseNativeCli(argv, COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)

const retiredKimiOcr = ['kimi-k2', '7-code'].join('.')
const retiredMinimaxLlm = ['MiniMax-M2', '5'].join('.')
const retiredMusicFree = 'music-2' + '.6-free'
const deprecatedTierSplitKey = 'tier' + 'Split'
const deprecatedOverallTierKey = 'overall' + 'Tier'

const RETIRED_FLAG_MODELS: Array<{ flag: string, model: string, message: string }> = [
  {
    flag: 'gemini',
    model: 'gemini-3.1-flash-lite',
    message: 'Model "gemini-3.1-flash-lite" is retired for --llm gemini[=model]. Use "gemini-3.7-flash" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'gemini-ocr',
    model: 'gemini-3.1-flash-lite',
    message: 'Model "gemini-3.1-flash-lite" is retired for --provider/--ocr gemini[=model]. Use "gemini-3.5-flash-lite" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'kimi-ocr',
    model: retiredKimiOcr,
    message: `Invalid model "${retiredKimiOcr}" for --provider/--ocr kimi[=model]. Allowed values: kimi-k2.6, kimi-k3`
  },
  {
    flag: 'kimi-ocr',
    model: `${retiredKimiOcr}-highspeed`,
    message: `Invalid model "${retiredKimiOcr}-highspeed" for --provider/--ocr kimi[=model]. Allowed values: kimi-k2.6, kimi-k3`
  },
  {
    flag: 'openai-tts',
    model: 'tts-1',
    message: 'Model "tts-1" is retired for --provider/--tts openai[=model]. Use "gpt-4o-mini-tts-2025-12-15" instead.'
  },
  {
    flag: 'openai-tts',
    model: 'tts-1-hd',
    message: 'Model "tts-1-hd" is retired for --provider/--tts openai[=model]. Use "gpt-4o-mini-tts-2025-12-15" instead.'
  },
  {
    flag: 'cartesia-tts',
    model: 'sonic-3.5-2026-05-04',
    message: 'Model "sonic-3.5-2026-05-04" is retired for --provider/--tts cartesia[=model]. Use "sonic-3.6-2026-08-27" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'inworld-tts',
    model: 'realtime-tts-2-flash',
    message: 'Model "realtime-tts-2-flash" is retired for --provider/--tts inworld[=model]. Use "realtime-tts-2" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'elevenlabs-music',
    model: 'music_v1',
    message: 'Model "music_v1" is retired for --provider/--music elevenlabs[=model]. Use "music_v2" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'gemini-music',
    model: 'lyria-3-clip-preview',
    message: 'Model "lyria-3-clip-preview" is retired for --provider/--music gemini[=model]. Use "lyria-3.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'gemini-music',
    model: 'lyria-3-pro-preview',
    message: 'Model "lyria-3-pro-preview" is retired for --provider/--music gemini[=model]. Use "lyria-3.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'runwayml/aleph-2',
    message: 'Model "runwayml/aleph-2" is retired for --provider/--video replicate[=model]. Use "grok-imagine-video-1.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'wan-video/wan-2.7-t2v',
    message: 'Model "wan-video/wan-2.7-t2v" is retired for --provider/--video replicate[=model]. Use "bytedance/seedance-2.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'kwaivgi/kling-v3-video',
    message: 'Model "kwaivgi/kling-v3-video" is retired for --provider/--video replicate[=model]. Use "pixverse/pixverse-v6" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'kwaivgi/kling-v3-omni-video',
    message: 'Model "kwaivgi/kling-v3-omni-video" is retired for --provider/--video replicate[=model]. Use "bytedance/seedance-2.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'bytedance/seedance-2.0',
    message: 'Model "bytedance/seedance-2.0" is retired for --provider/--video replicate[=model]. Use "bytedance/seedance-2.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'bytedance/seedance-2.0-fast',
    message: 'Model "bytedance/seedance-2.0-fast" is retired for --provider/--video replicate[=model]. Use "bytedance/seedance-2.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'grok-video',
    model: 'grok-imagine-video',
    message: 'Model "grok-imagine-video" is retired for --provider/--video grok[=model]. Use "grok-imagine-video-1.5" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'ltx-video',
    model: 'ltx-2-3-fast',
    message: 'Model "ltx-2-3-fast" is retired for --provider/--video ltx[=model]. Use "ltx-2-5-fast" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'ltx-video',
    model: 'ltx-2-3-pro',
    message: 'Model "ltx-2-3-pro" is retired for --provider/--video ltx[=model]. Use "ltx-2-5-pro" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'fal-video',
    model: 'fal-ai/pixverse/c1',
    message: 'Model "fal-ai/pixverse/c1" is retired for --provider/--video fal[=model]. Use "minimax/h3" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'gemini-video',
    model: 'veo-3.1-generate-preview',
    message: 'Model "veo-3.1-generate-preview" is retired for --provider/--video gemini[=model]. Use "veo-3.1-lite-generate-preview" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'gemini-video',
    model: 'veo-3.1-fast-generate-preview',
    message: 'Model "veo-3.1-fast-generate-preview" is retired for --provider/--video gemini[=model]. Use "veo-3.1-lite-generate-preview" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'minimax-music',
    model: retiredMusicFree,
    message: `Invalid model "${retiredMusicFree}" for ${formatModelSelector('minimax-music')}`
  },
  {
    flag: 'deepinfra-ocr',
    model: 'PaddlePaddle/PaddleOCR-VL-0.9B',
    message: 'Invalid model "PaddlePaddle/PaddleOCR-VL-0.9B" for --provider/--ocr deepinfra[=model]. Allowed values: google/gemma-4-31B-it'
  },
  {
    flag: 'assemblyai-stt',
    model: 'universal-2',
    message: 'Model "universal-2" is retired for --provider/--stt assemblyai[=model]. Use "universal-3-5-pro" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'gladia-stt',
    model: 'solaria-1',
    message: 'Model "solaria-1" is retired for --provider/--stt gladia[=model]. Use "solaria-3" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'speechmatics-stt',
    model: 'enhanced',
    message: 'Model "enhanced" is retired for --provider/--stt speechmatics[=model]. Use "melia-1" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'supadata-stt',
    model: 'native',
    message: 'Invalid model "native" for --provider/--stt supadata[=model]. Allowed values: auto'
  },
  {
    flag: 'supadata-stt',
    model: 'generate',
    message: 'Invalid model "generate" for --provider/--stt supadata[=model]. Allowed values: auto'
  }
]

describe('retired surfaces', () => {
  test('removed commands stay unregistered', () => {
    expect(COMMAND_DEFINITIONS.map((command) => command.name)).not.toContain('benchmark')
    expect(HELP_COMMAND_GROUP_BY_NAME).not.toHaveProperty('benchmark')
    expect(() => parseRoot(['benchmark'])).toThrow(NativeNoSuchCommandError)
    expect(() => parseRoot(['benchmark'])).toThrow('Unknown command "benchmark"')
    expect(() => parseRoot(['benchmark', '--help'])).toThrow('Unknown command "benchmark"')
  })

  test('removed command trees stay off disk', () => {
    expect(existsSync(resolve('src/cli/commands/setup-and-utilities/benchmark'))).toBe(false)
    expect(existsSync(resolve('src/types/benchmarks'))).toBe(false)
    expect(existsSync(resolve('docs/commands/00-setup-and-utilities/benchmark/benchmark.md'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/text/ocr/ocr-services/replicate-ocr'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/text/ocr/ocr-services/fal-ocr'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/setup-and-utilities/models/ocr-config/ocr-replicate.json'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/setup-and-utilities/models/ocr-config/ocr-fal.json'))).toBe(false)
  })

  test('retired models are rejected with public selectors', () => {
    for (const { flag, model, message } of RETIRED_FLAG_MODELS) {
      expect(() => buildOptsFromFlags({ [flag]: model })).toThrow(message)
    }
  })

  test('comic generate-images rejects the removed --panel spelling', () => {
    expect(() => parseCommandInvocation(
      [generateImagesCommandDefinition.name, 'script.md', '--panel', '1'],
      generateImagesCommandDefinition,
      GLOBAL_FLAG_DEFINITIONS
    )).toThrow('Unexpected flag: --panel')
  })

  test('write and setup help omit retired MiniMax LLM names', () => {
    const root = createNativeRootDefinition()
    const write = COMMAND_DEFINITIONS.find((command) => command.name === 'write')
    const setup = COMMAND_DEFINITIONS.find((command) => command.name === 'setup')
    if (!write || !setup) throw new Error('missing write or setup command')
    expect(renderCommandHelp(root, write)).not.toContain(retiredMinimaxLlm)
    expect(renderCommandHelp(root, setup)).not.toContain(retiredMinimaxLlm)
  })

  test('unsigned prebuilt metadata keys stay out of production setup sources', async () => {
    const dependencyMetadata = await Bun.file('src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts').text()
    expect(dependencyMetadata).not.toContain('prebuiltUrl')
    expect(dependencyMetadata).not.toContain('prebuiltSha256')
  })

  test('retired consensus report keys stay out of producer sources', async () => {
    const files = [
      ...await Array.fromAsync(new Bun.Glob('src/**/*.ts').scan()),
      '.codex/skills/consensus/scripts/run.ts'
    ]
    for (const file of files) {
      const source = await Bun.file(file).text()
      expect(source).not.toContain(deprecatedTierSplitKey)
      expect(source).not.toContain(deprecatedOverallTierKey)
    }
  })
})
