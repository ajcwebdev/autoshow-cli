import {
  describe,
  expect,
  test
} from 'bun:test'
import { resolvePriceSelection } from '../../../../test-runner/price-commands/resolve'
import { selectorMatchesFile } from '../../../../test-runner/price-commands/helpers'
import { BUDGET_PRICE_SELECTION_REGISTRY } from '../../../../test-runner/price-commands/registry/index'
import { evaluatePriceObservations, toObservation } from '../../../../test-runner/price-evaluation'
import { findUnevaluatedBudgetKeys, isConcurrentBudgetedTestsEnabled, shouldSkipBudgetKeys } from '../../../../test-utils/budget'
import {
  MINIMAX_INSTRUMENTAL_MUSIC_MODELS,
  DEEPGRAM_DEFAULT_VOICE
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { HelperBudgetKeySpec } from '~/types'
import { loadE2eTestSources } from './e2e-test-sources'

const extractExplicitBudgetedTestKeys = (source: string): string[] => {
  const keys: string[] = []
  const callPattern = /budgetedTest\s*\(\s*(?:(['"`])([^'"`$]*)\1|\[([\s\S]*?)\])/g
  let callMatch: RegExpExecArray | null

  while ((callMatch = callPattern.exec(source)) !== null) {
    const singleKey = callMatch[2]
    if (singleKey) {
      keys.push(singleKey)
      continue
    }

    const arraySource = callMatch[3]
    if (!arraySource) {
      continue
    }

    const arrayStringPattern = /(['"`])([^'"`$]*)\1/g
    let arrayMatch: RegExpExecArray | null
    while ((arrayMatch = arrayStringPattern.exec(arraySource)) !== null) {
      keys.push(arrayMatch[2] as string)
    }
  }

  return keys
}

const isBudgetKeyLiteral = (value: string): boolean => {
  return /^(?:extract|image|music|transcribe|tts|video|write)-/.test(value)
}

const extractBudgetKeyVariableLiterals = (source: string): string[] => {
  const keys: string[] = []

  for (const match of source.matchAll(/\bbudgetKey\s*:\s*(['"`])([^'"`$]+)\1/g)) {
    keys.push(match[2] as string)
  }

  for (const assignmentMatch of source.matchAll(/\b(?:const|let)\s+budgetKey\s*=\s*([^\n]+)/g)) {
    const assignmentSource = assignmentMatch[1] ?? ''
    for (const stringMatch of assignmentSource.matchAll(/(['"`])([^'"`$]+)\1/g)) {
      const value = stringMatch[2] as string
      if (isBudgetKeyLiteral(value)) {
        keys.push(value)
      }
    }
  }

  return keys
}

const readStringProperty = (source: string, propertyName: string): string | undefined => {
  const match = source.match(new RegExp(`${propertyName}\\s*:\\s*(['"])([^'"]+)\\1`))
  return match?.[2]
}

const readModelsProperty = (source: string, mode: 'strings' | 'objects'): string[] => {
  const startMatch = /models\s*:\s*\[/.exec(source)
  if (!startMatch) {
    return []
  }

  const start = startMatch.index + startMatch[0].length - 1
  let depth = 0
  let quote: string | undefined
  for (let index = start; index < source.length; index++) {
    const char = source[index]
    const previousChar = source[index - 1]
    if (quote) {
      if (char === quote && previousChar !== '\\') {
        quote = undefined
      }
      continue
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }

    if (char === '[') {
      depth++
    } else if (char === ']') {
      depth--
      if (depth === 0) {
        const body = source.slice(start + 1, index)
        if (mode === 'objects') {
          return [...body.matchAll(/\bmodel\s*:\s*(['"`])([^'"`]+)\1/g)].map(match => match[2] as string)
        }
        return [...body.matchAll(/(['"`])([^'"`]+)\1/g)].map(match => match[2] as string)
      }
    }
  }

  return []
}

const extractCallBodies = (source: string, callName: string): string[] => {
  const bodies: string[] = []
  let from = 0

  while (true) {
    const callIndex = source.indexOf(`${callName}(`, from)
    if (callIndex === -1) {
      break
    }

    const openParen = source.indexOf('(', callIndex)
    let depth = 0
    let quote: string | undefined
    for (let index = openParen; index < source.length; index++) {
      const char = source[index]
      const previousChar = source[index - 1]
      if (quote) {
        if (char === quote && previousChar !== '\\') {
          quote = undefined
        }
        continue
      }

      if (char === '\'' || char === '"' || char === '`') {
        quote = char
        continue
      }

      if (char === '(') {
        depth++
      } else if (char === ')') {
        depth--
        if (depth === 0) {
          bodies.push(source.slice(openParen + 1, index))
          from = index + 1
          break
        }
      }
    }

    if (from <= callIndex) {
      break
    }
  }

  return bodies
}

const helperBudgetKeySpecs: HelperBudgetKeySpec[] = [
  { callName: 'defineLLMWriteTest', prefix: 'write', serviceProperty: 'llmService', modelMode: 'strings' },
  { callName: 'defineSTTServiceTest', prefix: 'transcribe', serviceProperty: 'sttService', modelMode: 'strings' },
  { callName: 'defineOCRServiceTest', prefix: 'extract', serviceFromCliFlag: true, modelMode: 'strings' },
  { callName: 'defineImageServiceTest', prefix: 'image', serviceProperty: 'imageService', modelMode: 'objects' },
  { callName: 'defineVideoServiceTest', prefix: 'video', serviceProperty: 'videoService', modelMode: 'objects' },
  { callName: 'defineMusicServiceTest', prefix: 'music', serviceProperty: 'musicService', modelMode: 'objects' },
  { callName: 'defineTTSServiceTest', prefix: 'tts', serviceProperty: 'ttsService', modelMode: 'strings' },
] as const

const extractHelperGeneratedBudgetKeys = (file: string, source: string): { keys: string[], issues: string[] } => {
  const keys: string[] = []
  const issues: string[] = []

  if (extractCallBodies(source, 'defineGenerationServiceTest').length > 0) {
    issues.push(`${file}: generation e2e consumers must call the image, video, or music wrapper so budget keys remain source-inspectable`)
  }

  for (const spec of helperBudgetKeySpecs) {
    for (const callBody of extractCallBodies(source, spec.callName)) {
      const service = spec.serviceFromCliFlag
        ? readStringProperty(callBody, 'expectedService')
          ?? readStringProperty(callBody, 'provider')
        : readStringProperty(callBody, spec.serviceProperty)
      if (!service) {
        issues.push(`${file}: ${spec.callName} has no inspectable ${spec.serviceFromCliFlag ? 'expectedService/provider' : spec.serviceProperty}`)
        continue
      }

      const models = readModelsProperty(callBody, spec.modelMode)
      if (models.length === 0) {
        issues.push(`${file}: ${spec.callName} has no inspectable models`)
        continue
      }

      for (const model of models) {
        keys.push(`${spec.prefix}-${service}-${model}`)
      }
    }
  }

  return { keys, issues }
}

const extractE2EBudgetKeys = (file: string, source: string): { keys: string[], issues: string[] } => {
  const helperKeys = extractHelperGeneratedBudgetKeys(file, source)
  return {
    keys: [
      ...extractExplicitBudgetedTestKeys(source),
      ...extractBudgetKeyVariableLiterals(source),
      ...helperKeys.keys,
    ],
    issues: helperKeys.issues,
  }
}

describe('test-runner contracts', () => {
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
      const allFiles = sources.map(({ file }) => file)
      const selectedKeysByFile = new Map<string, Set<string>>()
      for (const file of allFiles) {
        selectedKeysByFile.set(file, new Set())
      }
      const budgetSkippableKeys = new Set<string>()
      for (const entry of BUDGET_PRICE_SELECTION_REGISTRY) {
        if (!entry.budgetSkippable) {
          continue
        }
        budgetSkippableKeys.add(entry.key)
        for (const file of allFiles) {
          if (selectorMatchesFile(entry, file)) {
            selectedKeysByFile.get(file)?.add(entry.key)
          }
        }
      }
      const missing: string[] = []
      const unselected: string[] = []
      const uninspectable: string[] = []

      for (const { file, source } of sources) {
        const extracted = extractE2EBudgetKeys(file, source)
        uninspectable.push(...extracted.issues)
        const budgetKeys = [...new Set(extracted.keys)]
        if (budgetKeys.length === 0) {
          continue
        }

        const selectedKeys = selectedKeysByFile.get(file) ?? new Set()

        for (const key of budgetKeys) {
          if (!budgetSkippableKeys.has(key)) {
            missing.push(`${file}: ${key}`)
            continue
          }
          if (!selectedKeys.has(key)) {
            unselected.push(`${file}: ${key}`)
          }
        }
      }

      expect(missing).toEqual([])
      expect(unselected).toEqual([])
      expect(uninspectable).toEqual([])
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

  test('TTS service budget preflight includes remaining service entries', () => {
      const allFiles = [
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/groq-canopylabs-orpheus-v1-english.test.ts',
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/cartesia-sonic-3.5-2026-05-04.test.ts',
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/deepgram-aura-2-thalia-en.test.ts',
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/minimax-speech-2.8-turbo.test.ts',
      ]

      const keys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-4-tts-e2e/tts-services/'
      ], { budgetSkippableOnly: true }).commands.map((command) => command.key)

      expect(keys).toContain('tts-groq-canopylabs/orpheus-v1-english')
      expect(keys).not.toContain(['tts-groq-canopylabs/orpheus', 'arabic-saudi'].join('-'))
      expect(keys).toContain('tts-cartesia-sonic-3.5-2026-05-04')
      expect(keys.filter((key) => key.startsWith('tts-deepgram-'))).toEqual([`tts-deepgram-${DEEPGRAM_DEFAULT_VOICE}`])
      expect(keys).not.toContain('tts-minimax-speech-2.8-turbo-clone')
    })

  test('music selected-file budget preflight includes keys for live ElevenLabs music skips', () => {
      const allFiles = [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music-v2-pipeline.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3-pro-preview.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0-pipeline.test.ts',
        'test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0-gemini-lyria-3-pro-preview.test.ts'
      ]

      const elevenlabsKeys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/'
      ], { budgetSkippableOnly: true }).commands.map((command) => command.key)
      expect(elevenlabsKeys).toContain('music-elevenlabs-music_v2')
      expect(elevenlabsKeys).toContain('music-pipeline-elevenlabs-music_v2')

      const minimaxKeys = resolvePriceSelection(allFiles, [
        'test/test-cases/e2e/service/step-7-music-gen-e2e/'
      ], { budgetSkippableOnly: true }).commands.map((command) => command.key)
      expect(minimaxKeys).toContain('music-multi-minimax-music-3.0-gemini-lyria-3-pro-preview')
      expect(minimaxKeys).toContain('music-pipeline-minimax-music-3.0')
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
