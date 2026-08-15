import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { estimateTtsCosts } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import { getTtsEstimation, getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildTtsBatchEstimateSummary, computeSuccessfulTtsBatchActualCost } from '~/cli/commands/process-steps/step-4-tts/tts-batch-summary'
import { runCommand } from '../../../../test-utils/test-helpers'
import type { AggregatedPriceEstimate, PreparedTtsInput, Step4Metadata, TtsTarget } from '~/types'
import { isRecord, parseJsonLines } from './shared'

const buildTtsMetadata = (overrides: Partial<Step4Metadata> = {}): Step4Metadata => ({
  ttsService: 'grok',
  ttsModel: 'grok-tts',
  processingTime: 1234,
  audioFileName: 'speech.wav',
  audioFileSize: 1234,
  chunkCount: 1,
  ...overrides
})

describe('price mode contracts', () => {
  test('TTS chunk limits use 2000 characters except Groq Orpheus', () => {
      expect(TTS_CHUNK_CHARACTER_LIMITS.groq).toBe(200)
      expect(Object.entries(TTS_CHUNK_CHARACTER_LIMITS)
        .filter(([provider]) => provider !== 'groq')
        .every(([, limit]) => limit === 2000)).toBe(true)
    })

  test('Mistral TTS estimates use published output-character pricing and provisional speed', () => {
      const model = 'voxtral-mini-tts-2603'
      const opts = {
        mistralTtsModels: [model],
        mistralTtsModel: model,
        mistralTtsVoice: 'voice-existing'
      } as Parameters<typeof estimateTtsCosts>[0]

      const cost = estimateTtsCosts(opts, 1000)[0]
      expect(cost?.inputCostPer1MCharactersCents).toBe(0)
      expect(cost?.outputCostPer1MCharactersCents).toBe(1600)
      expect(cost?.totalCost).toBe(1.6)

      const timing = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'mistral', model }],
        ttsCharacterCount: 1000
      })
      expect(timing.steps.find((step) => step.provider === 'mistral')?.processingTimeMs)
        .toBe(Math.round(getTtsEstimation('mistral', model).msPer1KChars))
    })

  test('Grok TTS estimates use current xAI Voice API character pricing', () => {
      const cost = estimateTtsCosts({
        grokTtsModels: ['grok-tts']
      } as Parameters<typeof estimateTtsCosts>[0], 1000)[0]

      expect(cost?.costPer1kCharactersCents).toBe(1.5)
      expect(cost?.totalCost).toBe(1.5)
    })

  test('Groq Orpheus TTS estimates use single character pricing', () => {
      const cost = estimateTtsCosts({
        groqTtsModels: ['canopylabs/orpheus-v1-english']
      } as Parameters<typeof estimateTtsCosts>[0], 1000)[0]

      expect(cost?.costPer1kCharactersCents).toBe(2.2)
      expect(cost?.inputCostPer1MCharactersCents).toBeUndefined()
      expect(cost?.outputCostPer1MCharactersCents).toBeUndefined()
      expect(cost?.totalCost).toBe(2.2)
    })

  test('Replicate Kokoro estimates variable runtime pricing per prediction', () => {
    const opts = {
      replicateTtsModels: ['jaaari/kokoro-82m']
    } as Parameters<typeof estimateTtsCosts>[0]
    const oneRequest = estimateTtsCosts(opts, 1)[0]
    const twoRequests = estimateTtsCosts(opts, 2001)[0]

    expect(getTtsPricing('replicate', 'jaaari/kokoro-82m').costPerRequestCents).toBe(0.022)
    expect(oneRequest).toMatchObject({ costPerRequestCents: 0.022, requestCount: 1, totalCost: 0.022 })
    expect(twoRequests).toMatchObject({ costPerRequestCents: 0.022, requestCount: 2, totalCost: 0.044 })
  })

  test('chunked TTS estimates use chunk concurrency for wall-clock time', () => {
      const model = 'grok-tts'
      const characterCount = 4_666
      const text = 'a'.repeat(characterCount)
      const rate = getTtsEstimation('grok', model).msPer1KChars

      const parallelTiming = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'grok', model }],
        ttsCharacterCount: characterCount,
        ttsInputText: text,
        ttsChunkConcurrency: 2
      })
      const serialTiming = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'grok', model }],
        ttsCharacterCount: characterCount,
        ttsInputText: text,
        ttsChunkConcurrency: 1
      })
      const syntheticTiming = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'grok', model }],
        ttsCharacterCount: characterCount,
        ttsChunkConcurrency: 2
      })

      expect(parallelTiming.steps[0]?.processingTimeMs).toBe(Math.round((2666 / 1000) * rate))
      expect(serialTiming.steps[0]?.processingTimeMs).toBe(Math.round((characterCount / 1000) * rate))
      expect(syntheticTiming.steps[0]?.processingTimeMs).toBe(parallelTiming.steps[0]?.processingTimeMs)
    })

  test('Groq Orpheus TTS keeps the 200-character chunk timing exemption', () => {
      const model = 'canopylabs/orpheus-v1-english'
      const characterCount = 450
      const rate = getTtsEstimation('groq', model).msPer1KChars
      const timing = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'groq', model }],
        ttsCharacterCount: characterCount,
        ttsInputText: 'a'.repeat(characterCount),
        ttsChunkConcurrency: 5
      })
      const immediateTiming = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'groq', model }],
        ttsCharacterCount: characterCount,
        ttsInputText: 'a'.repeat(characterCount),
        ttsChunkConcurrency: 5,
        concurrencyMode: 'immediate'
      })

      expect(timing.steps[0]?.processingTimeMs)
        .toBe(Math.round((400 / 1000) * rate))
      expect(immediateTiming.steps[0]?.processingTimeMs)
        .toBe(Math.round((200 / 1000) * rate))
    })

  test('ElevenLabs TTS estimates use model-aware chunk limits for wall-clock time', () => {
      const model = 'eleven_v3'
      const characterCount = 4_666
      const timing = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'elevenlabs', model }],
        ttsCharacterCount: characterCount,
        ttsInputText: 'a'.repeat(characterCount),
        ttsChunkConcurrency: 2
      })

      expect(timing.steps[0]?.processingTimeMs)
        .toBe(Math.round((characterCount / 1000) * getTtsEstimation('elevenlabs', model).msPer1KChars))
    })

  test('chunked TTS setup time is added once before parallel synthesis', () => {
      const model = 'gpt-4o-mini-tts-2025-12-15'
      const setupTimeMs = 10_000
      const rate = getTtsEstimation('openai', model).msPer1KChars
      const timing = computeEstimatedProcessingTimes({
        ttsTargets: [{ service: 'openai', model, setupTimeMs }],
        ttsCharacterCount: 4_666,
        ttsInputText: 'a'.repeat(4_666),
        ttsChunkConcurrency: 2
      })

      expect(timing.steps[0]?.processingTimeMs)
        .toBe(Math.round(setupTimeMs + (2666 / 1000) * rate))
    })

  test('tts --price reports chunk-concurrent Grok estimated time', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'autoshow-grok-tts-price-'))
      const inputPath = join(dir, 'long-tts.txt')
      const characterCount = 4_666
      const model = 'grok-tts'
      const rate = getTtsEstimation('grok', model).msPer1KChars

      await Bun.write(inputPath, 'a'.repeat(characterCount))

      try {
        const result = await runCommand([
          'src/cli/create-cli.ts',
          'tts',
          inputPath,
          '--provider',
          `grok=${model}`,
          '--tts-chunk-concurrency',
          '2',
          '--price',
          '--json'
        ], {
          env: { XAI_API_KEY: '' }
        })

        expect(result.exitCode).toBe(0)
        expect(result.outputDir).toBeNull()

        const emittedResult = parseJsonLines(`${result.stdout}\n${result.stderr}`)
          .find((entry) => isRecord(entry) && entry['dryRun'] === true)
        if (!isRecord(emittedResult)) {
          throw new Error('Missing price-mode timing JSON result')
        }

        const estimate = emittedResult['estimate']
        if (!isRecord(estimate)) {
          throw new Error('Missing price-mode estimate JSON result')
        }

        const timing = estimate['timing']
        if (!isRecord(timing)) {
          throw new Error('Missing price-mode timing JSON result')
        }

        const steps = timing['steps']
        if (!Array.isArray(steps)) {
          throw new Error('Missing price-mode timing steps')
        }

        const grokStep = steps.find((entry) =>
          isRecord(entry)
          && entry['step'] === 'tts'
          && entry['provider'] === 'grok'
          && entry['model'] === model
        )
        if (!isRecord(grokStep)) {
          throw new Error('Missing Grok timing step')
        }

        expect(grokStep['processingTimeMs']).toBe(Math.round((2666 / 1000) * rate))
        expect(grokStep['processingTimeMs']).toBeLessThan(Math.round((characterCount / 1000) * rate))
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })

  test('tts batch estimate summary simulates batch worker wall time', () => {
      const estimates: AggregatedPriceEstimate[] = [
        { steps: [], totalEstimatedCost: 1, timing: { totalProcessingTimeMs: 1000, steps: [] } },
        { steps: [], totalEstimatedCost: 2, timing: { totalProcessingTimeMs: 2000, steps: [] } },
        { steps: [], totalEstimatedCost: 3, timing: { totalProcessingTimeMs: 3000, steps: [] } }
      ]

      expect(buildTtsBatchEstimateSummary(estimates, 2, 5)).toEqual({
        inputCount: 3,
        batchConcurrency: 2,
        ttsChunkConcurrency: 5,
        totalEstimatedProcessingTimeMs: 6000,
        estimatedWallTimeMs: 4000,
        totalEstimatedCost: 6
      })
    })

  test('tts hosted batch estimate summary simulates the provider-wide chunk queue', () => {
      const model = 'gpt-4o-mini-tts-2025-12-15'
      const rate = getTtsEstimation('openai', model).msPer1KChars
      const preparedInputs: PreparedTtsInput[] = [
        {
          inputPath: 'large-a.md',
          text: 'a'.repeat(4100),
          ttsCharacterCount: 4100,
          ttsTimingInputText: 'a'.repeat(4100),
          dialogueRequested: false
        } as PreparedTtsInput,
        {
          inputPath: 'large-b.md',
          text: 'b'.repeat(4100),
          ttsCharacterCount: 4100,
          ttsTimingInputText: 'b'.repeat(4100),
          dialogueRequested: false
        } as PreparedTtsInput,
        {
          inputPath: 'small.md',
          text: 's'.repeat(100),
          ttsCharacterCount: 100,
          ttsTimingInputText: 's'.repeat(100),
          dialogueRequested: false
        } as PreparedTtsInput
      ]
      const targets: TtsTarget[] = [{
        service: 'openai',
        model,
        run: async () => ({
          audioPath: 'speech.wav',
          metadata: buildTtsMetadata({ ttsService: 'openai', ttsModel: model })
        })
      }]
      const estimates: AggregatedPriceEstimate[] = preparedInputs.map((input) => ({
        steps: [],
        totalEstimatedCost: 1,
        timing: {
          totalProcessingTimeMs: Math.round((input.ttsCharacterCount / 1000) * rate),
          steps: []
        }
      }))

      expect(buildTtsBatchEstimateSummary(estimates, 2, 2, { preparedInputs, targets })).toMatchObject({
        inputCount: 3,
        batchConcurrency: 2,
        ttsChunkConcurrency: 2,
        estimatedWallTimeMs: Math.round(4.2 * rate),
        totalEstimatedCost: 3
      })
    })

  test('tts batch summaries use ElevenLabs model-specific limits', () => {
    const preparedInputs: PreparedTtsInput[] = [{
      inputPath: 'elevenlabs.md',
      text: 'a'.repeat(6000),
      ttsCharacterCount: 6000,
      ttsTimingInputText: 'a'.repeat(6000),
      dialogueRequested: false
    } as PreparedTtsInput]
    const estimate: AggregatedPriceEstimate = { steps: [], totalEstimatedCost: 1, timing: { totalProcessingTimeMs: 1, steps: [] } }
    const targetFor = (model: string): TtsTarget => ({
      service: 'elevenlabs',
      model,
      run: async () => ({ audioPath: 'speech.wav', metadata: buildTtsMetadata({ ttsService: 'elevenlabs', ttsModel: model }) })
    })
    const rate = getTtsEstimation('elevenlabs', 'eleven_v3').msPer1KChars

    expect(buildTtsBatchEstimateSummary([estimate], 1, 2, { preparedInputs, targets: [targetFor('eleven_v3')] }).estimatedWallTimeMs).toBe(Math.round(5 * rate))
  })

  test('TTS preflight estimates preserve setup-fee and estimate-type metadata', () => {
    const estimated = preflightToEstimated({
      totalEstimatedCost: 26,
      steps: [{
        step: 'tts',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        costPer1kCharactersCents: 10,
        setupCostCents: 16,
        estimateType: 'exact',
        totalCost: 26
      }]
    })

    expect(estimated.steps).toEqual([{
      step: 'tts',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      cost: 26,
      costPer1kCharactersCents: 10,
      setupCostCents: 16,
      estimateType: 'exact'
    }])
  })

  test('tts batch actual total cost sums successful child runs by child character count', () => {
      const first = buildTtsMetadata({ audioFileName: 'first.wav' })
      const second = buildTtsMetadata({ audioFileName: 'second.wav' })
      const actualTotal = computeSuccessfulTtsBatchActualCost([
        { metadata: [first], characterCount: 1000 },
        { metadata: [second], characterCount: 2000 }
      ])
      const separateTotal = computeActualCosts({ step4: [first], ttsCharacterCount: 1000 }).totalCost
        + computeActualCosts({ step4: [second], ttsCharacterCount: 2000 }).totalCost
      const flattenedOvercount = computeActualCosts({ step4: [first, second], ttsCharacterCount: 3000 }).totalCost

      expect(actualTotal).toBe(separateTotal)
      expect(actualTotal).toBeLessThan(flattenedOvercount)
    })

  test('Speechify TTS estimates use registry pricing and timing defaults', () => {
      const costs = estimateTtsCosts({
        speechifyTtsModels: ['simba-3.2']
      } as Parameters<typeof estimateTtsCosts>[0], 1000)

      expect(costs.map((cost) => ({
        provider: cost.provider,
        model: cost.model,
        costPer1kCharactersCents: cost.costPer1kCharactersCents,
        setupCostCents: cost.setupCostCents,
        setupTimeMs: cost.setupTimeMs,
        totalCost: cost.totalCost
      }))).toEqual([
        { provider: 'speechify', model: 'simba-3.2', costPer1kCharactersCents: 1, setupCostCents: undefined, setupTimeMs: undefined, totalCost: 1 }
      ])

      const timing = computeEstimatedProcessingTimes({
        ttsTargets: [
          { service: 'speechify', model: 'simba-3.2' }
        ],
        ttsCharacterCount: 1000
      })

      expect(timing.steps.map((step) => ({
        provider: step.provider,
        model: step.model,
        processingTimeMs: step.processingTimeMs
      }))).toEqual([
        { provider: 'speechify', model: 'simba-3.2', processingTimeMs: 4_500 }
      ])
    })

  test('ElevenLabs TTS estimates use current API rates and target setup timing', () => {
      const baseCosts = estimateTtsCosts({
        elevenlabsTtsModels: ['eleven_v3']
      } as Parameters<typeof estimateTtsCosts>[0], 1000)

      expect(baseCosts.map((cost) => ({
        model: cost.model,
        costPer1kCharactersCents: cost.costPer1kCharactersCents,
        totalCost: cost.totalCost
      }))).toEqual([
        { model: 'eleven_v3', costPer1kCharactersCents: 10, totalCost: 10 }
      ])

      const timing = computeEstimatedProcessingTimes({
        ttsTargets: [
          { service: 'elevenlabs', model: 'eleven_v3', setupTimeMs: 10_000 },
          { service: 'elevenlabs', model: 'eleven_v3' }
        ],
        ttsCharacterCount: 4_666,
        ttsInputText: 'a'.repeat(4_666),
        ttsChunkConcurrency: 2
      })
      const rate = getTtsEstimation('elevenlabs', 'eleven_v3').msPer1KChars
      expect(timing.steps.map((step) => ({
        provider: step.provider,
        model: step.model,
        processingTimeMs: step.processingTimeMs
      }))).toEqual([
        { provider: 'elevenlabs', model: 'eleven_v3', processingTimeMs: Math.round(10_000 + (4666 / 1000) * rate) },
        { provider: 'elevenlabs', model: 'eleven_v3', processingTimeMs: Math.round((4666 / 1000) * rate) }
      ])

    })

  test('revised TTS models expose approved pricing and provisional timing', () => {
    for (const model of ['aura-2-helena-en', 'aura-2-arcas-en', 'aura-2-aries-en']) {
      expect(getTtsPricing('deepgram', model).costPer1kCharsCents).toBe(3)
      expect(getTtsEstimation('deepgram', model).msPer1KChars).toBe(39_639)
    }
    expect(getTtsPricing('elevenlabs', 'eleven_v3').costPer1kCharsCents).toBe(10)
    expect(getTtsEstimation('elevenlabs', 'eleven_v3').msPer1KChars).toBe(35_885)
  })
})
