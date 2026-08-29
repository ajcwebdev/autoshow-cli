import {
  describe,
  expect,
  test
} from 'bun:test'
import { resolvePriceSelection } from '../../../../test-runner/price-commands/resolve'
import { BUDGET_PRICE_SELECTION_REGISTRY } from '../../../../test-runner/price-commands/registry/index'
import { evaluatePriceObservations, toObservation } from '../../../../test-runner/price-evaluation'
import { findUnevaluatedBudgetKeys, isConcurrentBudgetedTestsEnabled, shouldSkipBudgetKeys } from '../../../../test-utils/budget'
import { MINIMAX_INSTRUMENTAL_MUSIC_MODELS } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { inspectBudgetSource } from './budget-source-inspection'
import { loadE2eTestSources } from './e2e-test-sources'
import { auditBudgetKeyCoverage, indexBudgetSkippableSelectors } from './budget-coverage-audit'

describe('test-runner contracts', () => {
  test('budget source inspection handles nested literal shapes without scanner false positives', () => {
    const inspected = inspectBudgetSource('fixture.ts', `
      // defineVideoServiceTest({ videoService: 'comment', models: [{ model: 'ignored' }] })
      wrap(defineLLMWriteTest({
        llmService: "open\\"ai",
        models: [\`gpt-template\`, 'gpt-escaped\\'quote'],
      }))
      defineImageServiceTest({
        imageService: 'replicate',
        models: [{ model: 'owner/model-a' }, { model: \`owner/model-b\` }],
      })
      defineOCRServiceTest({
        provider: 'fallback-provider',
        models: ['ocr-model'],
      })
      budgetedTest([\`tts-template-key\`, 'write-explicit-key'], 'title', () => {})
      const budgetKey = condition ? 'transcribe-one' : 'transcribe-two'
    `)

    expect(inspected.keys).toEqual([
      'tts-template-key',
      'write-explicit-key',
      'transcribe-one',
      'transcribe-two',
      'write-open"ai-gpt-template',
      "write-open\"ai-gpt-escaped'quote",
      'extract-fallback-provider-ocr-model',
      'image-replicate-owner/model-a',
      'image-replicate-owner/model-b',
    ])
    expect(inspected.issues).toEqual([])
  })

  test('budget source inspection preserves duplicate keys', () => {
    const inspected = inspectBudgetSource('duplicates.ts', `
      budgetedTest('tts-duplicate', 'one', () => {})
      budgetedTest(['tts-duplicate', 'tts-duplicate'], 'two', () => {})
      const fixture = { budgetKey: 'tts-duplicate' }
    `)

    expect(inspected.keys).toEqual([
      'tts-duplicate',
      'tts-duplicate',
      'tts-duplicate',
      'tts-duplicate',
    ])
    expect(inspected.issues).toEqual([])
  })

  test('budget source inspection reports dynamic properties instead of accepting them', () => {
    const inspected = inspectBudgetSource('dynamic.ts', `
      defineLLMWriteTest({
        llmService,
        models: ['literal-model', dynamicModel],
      })
      defineImageServiceTest({
        imageService: 'replicate',
        models: [{ model: \`model-\${suffix}\` }],
      })
      budgetedTest(dynamicKey, 'dynamic', () => {})
      const fixture = { budgetKey: dynamicKey }
      const budgetKey = makeBudgetKey()
    `)

    expect(inspected.keys).toEqual([])
    expect(inspected.issues).toEqual([
      'dynamic.ts: budgetedTest has a dynamic budget key; use a string literal, literal array, or inspectable budgetKey declaration',
      'dynamic.ts: budgetKey property has a dynamic value; use a string literal',
      'dynamic.ts: budgetKey declaration has dynamic or non-budget values; use inspectable budget key literals',
      'dynamic.ts: defineLLMWriteTest has a dynamic llmService; use a string literal',
      'dynamic.ts: defineImageServiceTest models contain dynamic values; use only inspectable string/model literals',
    ])
  })

  test('budget source inspection rejects malformed TypeScript with a location', () => {
    const inspected = inspectBudgetSource('malformed.ts', `
      defineTTSServiceTest({
        ttsService: 'deepgram',
        models: ['aura'
      })
    `)

    expect(inspected.keys).toEqual([])
    expect(inspected.issues).toHaveLength(1)
    expect(inspected.issues[0]).toContain('malformed.ts:')
    expect(inspected.issues[0]).toContain('TypeScript parse error:')
  })

  test('budget-skip entries are emitted from skipped entry keys', () => {
      const evaluation = evaluatePriceObservations('Selected paths: step-3-write-e2e/write-services/openai-gpt-5.5.test.ts', [
        {
          name: 'write-openai-gpt-5.5',
          key: 'write-openai-gpt-5.5',
          args: ['cmd-a'],
          exitCode: 0,
          durationMs: 10,
          costCents: 3,
          failureMessage: null,
          budgetSkippable: true
        },
        {
          name: 'write-openai-gpt-5.4-mini',
          key: 'write-openai-gpt-5.4-mini',
          args: ['cmd-b'],
          exitCode: 0,
          durationMs: 10,
          costCents: 1,
          failureMessage: null,
          budgetSkippable: true
        }
      ], 200)

      expect(evaluation.budgetSummary?.skipKeys).toEqual(['write-openai-gpt-5.5'])
      expect(evaluation.budgetSummary?.budgetHundredthCents).toBe(200)
      expect(evaluation.budgetSummary?.skippedEntries).toEqual([
        { key: 'write-openai-gpt-5.5', selectedCostCents: 3 }
      ])
      expect(evaluation.commandResults.map((result) => result.status)).toEqual(['skipped', 'passed'])
    })

  test('sub-cent budget values compare against cent-denominated estimates', () => {
      const evaluation = evaluatePriceObservations('Selected paths: sub-cent-budget.test.ts', [
        {
          name: 'sub-cent-pass',
          key: 'sub-cent-pass',
          args: ['cmd-a'],
          exitCode: 0,
          durationMs: 10,
          costCents: 0.009,
          failureMessage: null,
          budgetSkippable: true
        },
        {
          name: 'sub-cent-skip',
          key: 'sub-cent-skip',
          args: ['cmd-b'],
          exitCode: 0,
          durationMs: 10,
          costCents: 0.031,
          failureMessage: null,
          budgetSkippable: true
        }
      ], 1)

      expect(evaluation.budgetSummary?.budgetHundredthCents).toBe(1)
      expect(evaluation.budgetSummary?.skipKeys).toEqual(['sub-cent-skip'])
      expect(evaluation.commandResults.map((result) => result.status)).toEqual(['passed', 'skipped'])
    })

  test('multi-key budget predicate skips when any component key is skipped', () => {
      const previous = process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
      try {
        process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = JSON.stringify(['component-b'])

        expect(shouldSkipBudgetKeys(['component-a', 'component-b'])).toBe(true)
        expect(shouldSkipBudgetKeys(['component-a', 'component-c'])).toBe(false)
      } finally {
        if (previous === undefined) {
          delete process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS']
        } else {
          process.env['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = previous
        }
      }
    })

  test('budgeted tests stay serial unless AUTOSHOW_TEST_CONCURRENT=1', () => {
      const previous = process.env['AUTOSHOW_TEST_CONCURRENT']
      try {
        delete process.env['AUTOSHOW_TEST_CONCURRENT']
        expect(isConcurrentBudgetedTestsEnabled()).toBe(false)

        process.env['AUTOSHOW_TEST_CONCURRENT'] = '0'
        expect(isConcurrentBudgetedTestsEnabled()).toBe(false)

        process.env['AUTOSHOW_TEST_CONCURRENT'] = '1'
        expect(isConcurrentBudgetedTestsEnabled()).toBe(true)
      } finally {
        if (previous === undefined) {
          delete process.env['AUTOSHOW_TEST_CONCURRENT']
        } else {
          process.env['AUTOSHOW_TEST_CONCURRENT'] = previous
        }
      }
    })

  test('e2e budget keys resolve to budget-skippable price registry entries', async () => {
      const sources = await loadE2eTestSources()
      const index = indexBudgetSkippableSelectors(sources.map(({ file }) => file), BUDGET_PRICE_SELECTION_REGISTRY)
      const { missing, unselected, uninspectable } = auditBudgetKeyCoverage(sources, index, inspectBudgetSource)

      expect(missing).toEqual([])
      expect(unselected).toEqual([])
      expect(uninspectable).toEqual([])
    })

  test('budget coverage audit separates missing, unselected, and uninspectable sources', () => {
      const matchedFile = 'test/test-cases/e2e/matched.test.ts'
      const unmatchedFile = 'test/test-cases/e2e/unmatched.test.ts'
      const emptyFile = 'test/test-cases/e2e/empty.test.ts'
      const registry = [{
        name: 'known',
        key: 'known-key',
        args: ['command'],
        budgetSkippable: true,
        selector: matchedFile,
        selectorKind: 'file' as const,
      }]
      const sources = [
        { file: matchedFile, source: 'known-key' },
        { file: unmatchedFile, source: 'known-key missing-key issue' },
        { file: emptyFile, source: '' },
      ]
      const inspect = (file: string, source: string) => ({
        keys: source.split(' ').filter(token => token.endsWith('-key')),
        issues: source.includes('issue') ? [`${file}: dynamic key`] : [],
      })
      const index = indexBudgetSkippableSelectors(sources.map(source => source.file), registry)

      expect(auditBudgetKeyCoverage(sources, index, inspect)).toEqual({
        missing: [`${unmatchedFile}: missing-key`],
        unselected: [`${unmatchedFile}: known-key`],
        uninspectable: [`${unmatchedFile}: dynamic key`],
      })
    })

  test('Replicate image live tests resolve all seven exact budget keys', () => {
      const file = 'test/test-cases/e2e/service/step-5-image-gen-e2e/replicate-image.test.ts'
      const keys = resolvePriceSelection([file], [file], { budgetSkippableOnly: true }).commands.map(command => command.key)

      expect(keys).toEqual([
        'image-replicate-bytedance/seedream-4.5',
        'image-replicate-bytedance/seedream-5-lite',
        'image-replicate-bytedance/seedream-5-pro',
        'image-replicate-qwen/qwen-image-2-pro',
        'image-replicate-qwen/qwen-image-2',
        'image-replicate-wan-video/wan-2.7-image-pro',
        'image-replicate-wan-video/wan-2.7-image',
      ])
    })

  test('a 0.10 cent threshold marks all seven Replicate image keys over budget', () => {
      const file = 'test/test-cases/e2e/service/step-5-image-gen-e2e/replicate-image.test.ts'
      const commands = resolvePriceSelection([file], [file], { budgetSkippableOnly: true }).commands
      const observations = commands.map((command) =>
        toObservation(command, { exitCode: 0, durationMs: 0, parsedCost: 1 })
      )

      const evaluation = evaluatePriceObservations('Replicate images', observations, 10)
      expect([...(evaluation.budgetSummary?.skipKeys ?? [])].sort()).toEqual(commands.map(command => command.key).sort())
      expect(evaluation.budgetSummary?.commandsSkipped).toBe(7)
    })

  test('unevaluated and malformed budget handshakes never execute test callbacks', () => {
      const previous = process.env['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS']
      try {
        process.env['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS'] = '[]'
        expect(findUnevaluatedBudgetKeys('unmapped-key')).toEqual(['unmapped-key'])

        process.env['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS'] = 'not-json'
        expect(findUnevaluatedBudgetKeys('malformed-key')).toEqual(['malformed-key'])

        process.env['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS'] = '["component-a"]'
        expect(findUnevaluatedBudgetKeys(['component-a', 'component-b'])).toEqual(['component-b'])
      } finally {
        if (previous === undefined) {
          delete process.env['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS']
        } else {
          process.env['AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS'] = previous
        }
      }
    })

  test('TTS service budget preflight includes active service entries', () => {
      const allFiles = [
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/grok-tts.test.ts',
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/cartesia-sonic-3.5-2026-05-04.test.ts',
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/deepinfra-chatterbox.test.ts',
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/minimax-speech-2.8-turbo.test.ts',
      ]

      const keys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/'
      ], { budgetSkippableOnly: true }).commands.map((command) => command.key)

      expect(keys).toContain('tts-grok-grok-tts')
      expect(keys).toContain('tts-cartesia-sonic-3.5-2026-05-04')
      expect(keys).toContain('tts-deepinfra-ResembleAI/chatterbox')
      expect(keys).not.toContain('tts-minimax-speech-2.8-turbo-clone')
    })

  test('music selected-file budget preflight includes keys for live ElevenLabs music skips', () => {
      const allFiles = [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3-pro-preview.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0-gemini-lyria-3-pro-preview.test.ts'
      ]

      const elevenlabsKeys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/'
      ], { budgetSkippableOnly: true }).commands.map((command) => command.key)
      expect(elevenlabsKeys).toContain('music-elevenlabs-music_v2')

      const minimaxKeys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/'
      ], { budgetSkippableOnly: true }).commands.map((command) => command.key)
      expect(minimaxKeys).toContain('music-multi-minimax-music-3.0-gemini-lyria-3-pro-preview')
      for (const model of MINIMAX_INSTRUMENTAL_MUSIC_MODELS) {
        expect(minimaxKeys).toContain(`music-minimax-${model}`)
      }
      expect(minimaxKeys).not.toContain('music-minimax-' + 'music-2' + '.5')

      const geminiKeys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3-pro-preview.test.ts'
      ], { budgetSkippableOnly: true }).commands.map((command) => command.key)
      expect(geminiKeys).toContain('music-gemini-lyria-3-pro-preview')
      expect(geminiKeys).not.toContain('music-gemini-lyria-3-clip-preview')
    })
})
