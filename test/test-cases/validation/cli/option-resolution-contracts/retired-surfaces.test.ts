import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { NativeNoSuchCommandError } from '~/cli/native/native-errors'
import { parseCommandInvocation, parseNativeCli } from '~/cli/native/native-parser'
import { generateImagesCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { formatModelSelector } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { validateMinimaxModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
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
    message: 'Model "gemini-3.1-flash-lite" is retired for --llm gemini[=model]. Use "gemini-3.5-flash-lite" instead. AutoShow will not silently substitute a different model identity.'
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
    flag: 'groq-tts',
    model: 'canopylabs/orpheus-arabic-saudi',
    message: 'Model "canopylabs/orpheus-arabic-saudi" is retired for --provider/--tts groq[=model]. Use "canopylabs/orpheus-v1-english" instead.'
  },
  {
    flag: 'elevenlabs-music',
    model: 'music_v1',
    message: 'Model "music_v1" is retired for --provider/--music elevenlabs[=model]. Use "music_v2" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'gemini-music',
    model: 'lyria-3-clip-preview',
    message: 'Model "lyria-3-clip-preview" is retired for --provider/--music gemini[=model]. Use "lyria-3-pro-preview" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'runwayml/aleph-2',
    message: 'Model "runwayml/aleph-2" is retired for --provider/--video replicate[=model]. Use "grok-imagine-video" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'replicate-video',
    model: 'wan-video/wan-2.7-t2v',
    message: 'Model "wan-video/wan-2.7-t2v" is retired for --provider/--video replicate[=model]. Use "bytedance/seedance-2.0-fast" instead. AutoShow will not silently substitute a different model identity.'
  },
  {
    flag: 'minimax-music',
    model: retiredMusicFree,
    message: `Invalid model "${retiredMusicFree}" for ${formatModelSelector('minimax-music')}`
  },
  {
    flag: 'deepinfra-ocr',
    model: 'PaddlePaddle/PaddleOCR-VL-0.9B',
    message: 'Invalid model "PaddlePaddle/PaddleOCR-VL-0.9B" for --provider/--ocr deepinfra[=model]. Allowed values: google/gemma-3-27b-it, meta-llama/Llama-4-Scout-17B-16E-Instruct, mistralai/Mistral-Small-3.2-24B-Instruct-2506, Qwen/Qwen3-VL-235B-A22B-Instruct, Qwen/Qwen3-VL-30B-A3B-Instruct'
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
    expect(existsSync(resolve('docs/commands/setup-and-utilities/benchmark/benchmark.md'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/replicate-ocr'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/fal-ocr'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/setup-and-utilities/models/ocr-config/ocr-replicate.json'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/setup-and-utilities/models/ocr-config/ocr-fal.json'))).toBe(false)
  })

  test('retired models are rejected with public selectors', () => {
    for (const { flag, model, message } of RETIRED_FLAG_MODELS) {
      expect(() => buildOptsFromFlags({ [flag]: model })).toThrow(message)
    }
    expect(() => validateMinimaxModel(retiredMinimaxLlm))
      .toThrow(`Invalid model "${retiredMinimaxLlm}" for --llm minimax[=model]. Allowed values: MiniMax-M3`)
    expect(() => validateMinimaxModel(`${retiredMinimaxLlm}-highspeed`))
      .toThrow(`Invalid model "${retiredMinimaxLlm}-highspeed" for --llm minimax[=model]. Allowed values: MiniMax-M3`)
  })

  test('comic generate-images rejects the removed --panel spelling', () => {
    expect(() => parseCommandInvocation(
      [generateImagesCommandDefinition.name, 'script.md', '--panel', '1'],
      generateImagesCommandDefinition,
      GLOBAL_FLAG_DEFINITIONS
    )).toThrow('Unexpected flag: --panel')
  })

  test('write and config help omit retired MiniMax LLM names', () => {
    const root = createNativeRootDefinition()
    const write = COMMAND_DEFINITIONS.find((command) => command.name === 'write')
    const config = COMMAND_DEFINITIONS.find((command) => command.name === 'config')
    if (!write || !config) throw new Error('missing write or config command')
    expect(renderCommandHelp(root, write)).not.toContain(retiredMinimaxLlm)
    expect(renderCommandHelp(root, config)).not.toContain(retiredMinimaxLlm)
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
