import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { rm } from 'node:fs/promises'
import { EMPTY_PRICE_CONFIG_PATH, withEmptyPriceConfig } from '../../../../test-runner/price-command-config'
import { resolvePriceSelection } from '../../../../test-runner/price-commands/resolve'
import { BUDGET_PRICE_SELECTION_REGISTRY } from '../../../../test-runner/price-commands/registry/index'
import { loadE2eTestSources } from './e2e-test-sources'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('test-runner contracts', () => {
  test('price config isolation appends empty config to mapped write price commands', () => {
      const args = ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'openai=gpt-5.5', '--price']

      expect(withEmptyPriceConfig(args)).toEqual([
        ...args,
        '--config-path',
        EMPTY_PRICE_CONFIG_PATH,
      ])
    })

  test('price config isolation appends empty config to mapped tts price commands', () => {
      const args = ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/1-tts.md', '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--price']

      expect(withEmptyPriceConfig(args)).toEqual([
        ...args,
        '--config-path',
        EMPTY_PRICE_CONFIG_PATH,
      ])
    })

  test('price config isolation preserves explicit config paths', () => {
      const separateConfigArgs = [
        'src/cli/create-cli.ts',
        'write',
        'https://ajc.pics/autoshow/examples/1-audio.mp3',
        '--llm',
        'openai=gpt-5.5',
        '--price',
        '--config-path',
        'config/custom-autoshow.json',
      ]
      const equalsConfigArgs = [
        'src/cli/create-cli.ts',
        'tts',
        'input/examples/tts/1-tts.md',
        '--provider',
        'openai=gpt-4o-mini-tts-2025-12-15',
        '--price',
        '--config-path=config/custom-autoshow.json',
      ]

      expect(withEmptyPriceConfig(separateConfigArgs)).toEqual(separateConfigArgs)
      expect(withEmptyPriceConfig(equalsConfigArgs)).toEqual(equalsConfigArgs)
    })

  test('price config isolation leaves non-CLI runner commands unchanged', () => {
      const args = ['test/test-runner.ts', 'test/test-cases/e2e/local/step-3-write-e2e', '--price']

      expect(withEmptyPriceConfig(args)).toEqual(args)
    })

  test('price-flag, validation, and setup paths stay mappedless in price selection', () => {
      const allFiles = [
        'test/test-cases/setup/tts-models/tts-setup.test.ts',
        'test/test-cases/price-flag/write-price.test.ts',
        'test/test-cases/validation/test-runner-contracts.test.ts'
      ]

      expect(resolvePriceSelection(allFiles, ['test/test-cases/price-flag/'])).toEqual({
        suiteName: 'Selected paths: price-flag',
        commands: []
      })
      expect(resolvePriceSelection(allFiles, ['test/test-cases/validation/'])).toEqual({
        suiteName: 'Selected paths: validation',
        commands: []
      })
      expect(resolvePriceSelection(allFiles, ['test/test-cases/setup/'])).toEqual({
        suiteName: 'Selected paths: setup',
        commands: []
      })
    })

  test('price mode uses e2e path selections', () => {
      const allFiles = [
        'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/mistral-ocr-2512.test.ts',
        'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts',
        'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts'
      ]

      const selected = resolvePriceSelection(allFiles, ['test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/'])
      const keys = selected.commands.map((command) => command.key)

      expect(selected.suiteName).toBe('Selected paths: service/step-2-ocr-e2e/ocr-services')
      expect(keys).toContain('extract-mistral-mistral-ocr-2512')
      expect(keys).toContain('extract-firecrawl-url')
    })

  test('price mode with no path filters resolves all mapped tests', () => {
      const selected = resolvePriceSelection([], [])
      const keys = selected.commands.map((command) => command.key)

      expect(selected.suiteName).toBe('All mapped tests')
      expect(keys).toContain('extract-firecrawl-url')
      expect(keys).toContain('music-elevenlabs-music_v2')
      expect(keys).toContain('tts-openai-gpt-4o-mini-tts-2025-12-15')
    })

  test('extract price registry commands use public selector flags', () => {
      const internalExtractSelectorFlags = new Set([
        '--gemini-ocr',
        '--gemini-stt',
        '--openai-ocr',
        '--mistral-stt',
        '--scrapecreators-stt',
        '--supadata-stt'
      ])

      const offenders = BUDGET_PRICE_SELECTION_REGISTRY
        .filter(entry => entry.args[0] === 'src/cli/create-cli.ts' && entry.args[1] === 'extract')
        .flatMap(entry =>
          entry.args
            .filter(arg => internalExtractSelectorFlags.has(arg))
            .map(arg => `${entry.key}: ${arg}`)
        )

      expect(offenders).toEqual([])
    })

  test('specific e2e files resolve only their mapped price commands', () => {
      const allFiles = [
        'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/mistral-ocr-2512.test.ts',
        'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts'
      ]

      const serviceModelKeys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/mistral-ocr-2512.test.ts'
      ]).commands.map((command) => command.key)
      const firecrawlKeys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts'
      ]).commands.map((command) => command.key)

      expect(serviceModelKeys).toContain('extract-mistral-mistral-ocr-2512')
      expect(serviceModelKeys).not.toContain('extract-firecrawl-url')
      expect(firecrawlKeys).toEqual(['extract-firecrawl-url'])
    })

  test('price path selections match path boundaries', () => {
      const allFiles = [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3-pro-preview.test.ts',
        'test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts'
      ]

      const musicKeys = resolvePriceSelection(allFiles, ['test/test-cases/e2e/service/step-7-music-gen-e2e/'])
        .commands.map((command) => command.key)
      const lyricsVideoKeys = resolvePriceSelection(allFiles, ['test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/'])
        .commands.map((command) => command.key)

      expect(musicKeys).toContain('music-elevenlabs-music_v2')
      expect(musicKeys).not.toContain('transcribe-whisper-large-v3-turbo')
      expect(lyricsVideoKeys).toContain('transcribe-whisper-large-v3-turbo')
      expect(lyricsVideoKeys).not.toContain('music-elevenlabs-music_v2')
    })

  test('e2e test files do not contain direct --price command coverage', async () => {
      const filesWithPriceFlag = (await loadE2eTestSources())
        .filter(({ source }) => source.includes('--price'))
        .map(({ file }) => file)

      expect(filesWithPriceFlag).toEqual([])
    })
})
