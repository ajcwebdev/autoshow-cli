import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runImageBenchmark } from '~/cli/commands/setup-and-utilities/benchmark/run-image-benchmark'
import { runTextBenchmark } from '~/cli/commands/setup-and-utilities/benchmark/run-text-benchmark'
import { runVideoBenchmark } from '~/cli/commands/setup-and-utilities/benchmark/run-video-benchmark/run-video-benchmark'
import { resolveVisionProviders } from '~/cli/commands/setup-and-utilities/benchmark/vision-benchmark-engine'
import { exec } from '~/utils/cli-utils'
import type { BenchmarkFlags, MediaBenchmarkRequestBody } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

const envKeys = ['OPENAI_API_KEY']
const tempDirs = setupContractSuiteLifecycle({ envKeys, tempPrefix: 'autoshow-media-benchmark-' })
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
)

const makeTempRoot = async (prefix: string): Promise<string> => {
  return await tempDirs.make(prefix)
}

const installFetch = installMockFetch

const imageJudgeOutput = (score: number, summary: string): Record<string, unknown> => ({
  output_text: JSON.stringify({
    promptAdherence: score,
    visualQuality: score,
    artifactControl: score,
    composition: score,
    detailTextHandling: score,
    summary,
    strengths: [`score ${score} strength`],
    issues: score >= 8 ? [] : ['visible weakness']
  }),
  usage: {
    input_tokens: 12,
    output_tokens: 8
  }
})

const writeImageRun = async (runDir: string): Promise<void> => {
  await mkdir(runDir, { recursive: true })
  await writeFile(join(runDir, 'openai.png'), onePixelPng)
  await writeFile(join(runDir, 'bfl.png'), onePixelPng)
  await writeSingleManifestFixture(runDir, 'image', {
      input: 'A crisp technical infographic with readable labels.',
      image: [
        {
          imageService: 'openai',
          imageModel: 'gpt-image-2',
          processingTime: 1250,
          providerCostCents: 5.3,
          imageFileNames: ['openai.png']
        },
        {
          imageService: 'bfl',
          imageModel: 'flux-2-pro',
          processingTime: 950,
          providerCostCents: 0.5,
          imageFileNames: ['bfl.png']
        }
      ]
  })
}

const imageBenchmarkFlags: BenchmarkFlags = {
  image: true,
  bitrates: '',
  speeds: '',
  'reference-stt': '',
  'skip-compression': false,
  'skip-speed': false,
  'image-judge-model': 'gpt-5.5'
}

const textBenchmarkFlags: BenchmarkFlags = {
  text: true,
  bitrates: '',
  speeds: '',
  'reference-stt': '',
  'skip-compression': false,
  'skip-speed': false
}

describe('image benchmark contracts', () => {
  test('benchmark --image sends Responses API vision judge requests and writes quality reports', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'

    const calls = installFetch((call) =>
      jsonResponse(
        call.bodyText.includes('openai/gpt-image-2')
          ? imageJudgeOutput(9, 'Strong prompt match with clean labels.')
          : imageJudgeOutput(6, 'Partially matches the infographic prompt.')
      )
    )

    const runDir = await makeTempRoot('autoshow-image-benchmark-')
    await writeImageRun(runDir)

    await runImageBenchmark(runDir, imageBenchmarkFlags)

    expect(calls).toHaveLength(2)
    const firstCall = calls[0]
    expect(firstCall).toBeDefined()
    if (!firstCall) throw new Error('expected first fetch call')

    const firstBody = firstCall.bodyJson as MediaBenchmarkRequestBody | undefined
    expect(firstCall.url).toBe('https://api.openai.com/v1/responses')
    expect(firstCall.method).toBe('POST')
    expect(firstCall.headers.get('authorization')).toBe('Bearer openai-key')
    expect(firstBody?.model).toBe('gpt-5.5')
    expect(firstBody?.text?.format).toMatchObject({
      type: 'json_schema',
      name: 'image_quality_evaluation',
      strict: true
    })

    const imagePart = firstBody?.input?.[0]?.content?.find((part) => part['type'] === 'input_image')
    expect(imagePart?.['detail']).toBe('auto')
    expect(String(imagePart?.['image_url']).startsWith('data:image/png;base64,')).toBe(true)

    const qualityReport = await Bun.file(join(runDir, 'image-quality-report.json')).json() as {
      providers: Array<{
        providerKey: string
        qualityScore: number
        images: Array<{ criterionScores: { promptAdherence: number } }>
      }>
    }
    expect(Object.keys(qualityReport)).toEqual([
      'schemaVersion', 'kind', 'runDir', 'runName', 'generatedAt', 'judge', 'prompt', 'rubric', 'providerCount', 'imageCount', 'providers'
    ])
    expect(Object.keys(qualityReport.providers[0] ?? {})).toEqual([
      'rank', 'providerKey', 'provider', 'model', 'group', 'imageFiles', 'imageCount', 'processingTimeMs', 'costCents',
      'criterionScores', 'averageScore10', 'qualityScore', 'qualityMetric', 'evidence', 'images'
    ])
    expect(qualityReport.providers.map((provider) => provider.providerKey)).toEqual([
      'openai/gpt-image-2',
      'bfl/flux-2-pro'
    ])
    expect(qualityReport.providers[0]?.qualityScore).toBe(90)
    expect(qualityReport.providers[0]?.images[0]?.criterionScores.promptAdherence).toBe(9)

    const comparison = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
      providerGroups: {
        service: {
          providers: Array<{
            providerKey: string
            qualityScore: number
            metrics: { qualityScore: number }
            imageQuality: { evidence: { summary: string } }
          }>
        }
      }
      rankingSurfaces: {
        service: {
          automatedQuality: Array<{ providerKey: string, value: number | null }>
          highestQuality: Array<{ providerKey: string, value: number | null }>
          humanQuality: Array<{ providerKey: string, value: number | null }>
          humanQualityUnavailableReason: string | null
        }
      }
    }
    const openaiProvider = comparison.providerGroups.service.providers.find((provider) => provider.providerKey === 'openai/gpt-image-2')
    expect(openaiProvider?.qualityScore).toBe(90)
    expect(openaiProvider?.metrics.qualityScore).toBe(90)
    expect(openaiProvider?.imageQuality.evidence.summary).toContain('Strong prompt match')
    expect(comparison.rankingSurfaces.service.automatedQuality[0]).toMatchObject({
      providerKey: 'openai/gpt-image-2',
      value: 90
    })
    expect(comparison.rankingSurfaces.service.highestQuality).toEqual(comparison.rankingSurfaces.service.automatedQuality)
    expect(comparison.rankingSurfaces.service.humanQuality).toEqual([])
    expect(comparison.rankingSurfaces.service.humanQualityUnavailableReason).toContain('humanQualityScore')

    const qualityMarkdown = await Bun.file(join(runDir, 'image-quality-report.md')).text()
    const comparisonMarkdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(qualityMarkdown).toContain('# Image Quality Report')
    expect(comparisonMarkdown).toContain('### Automated Quality')
    expect(comparisonMarkdown).not.toContain('Top 3')
    expect(comparisonMarkdown).toContain('90.00/100')
  })
})

const writeTextRun = async (runDir: string): Promise<void> => {
  await mkdir(runDir, { recursive: true })
  await writeFile(join(runDir, 'llama-output.md'), 'Local write output.\n')
  await writeFile(join(runDir, 'groq-output.md'), 'Groq write output.\n')
  await writeFile(join(runDir, 'minimax-output.md'), 'MiniMax write output.\n')
  await writeSingleManifestFixture(runDir, 'write', {
      step3: [
        {
          llmService: 'llama.cpp',
          llmModel: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
          processingTime: 2400,
          inputTokenCount: 2000,
          outputTokenCount: 1000,
          tokenCountSource: 'provider',
          providerUsage: { prompt_tokens: 2000, completion_tokens: 1000 },
          outputFileName: 'llama-output.md'
        },
        {
          llmService: 'groq',
          llmModel: 'openai/gpt-oss-120b',
          processingTime: 6000,
          inputTokenCount: 10000,
          outputTokenCount: 2000,
          tokenCountSource: 'provider',
          providerUsage: { prompt_tokens: 10000, completion_tokens: 2000, total_tokens: 12000 },
          rawProviderUsage: { queue_time: 0.01 },
          outputFileName: 'groq-output.md'
        },
        {
          llmService: 'minimax',
          llmModel: 'MiniMax-M3',
          processingTime: 2500,
          inputTokenCount: 3000,
          outputTokenCount: 500,
          tokenCountSource: 'provider',
          providerUsage: { total_tokens: 3500 },
          outputFileName: 'minimax-output.md'
        }
      ],
      cost: {
        actual: {
          steps: [
            { step: 'llm', provider: 'groq', model: 'openai/gpt-oss-120b', cost: 1.2 },
            { step: 'llm', provider: 'minimax', model: 'MiniMax-M3', cost: 3.6 }
          ]
        }
      },
      timing: {
        actual: {
          steps: [
            {
              step: 'llm',
              provider: 'llama.cpp',
              model: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
              processingTimeMs: 2400,
              msPerUnit: 800,
              throughputValue: 1.25,
              throughputUnit: 'KTokensPerSecond',
              rateBasis: '1KTokens',
              inputMetric: 'tokens',
              inputValue: 3000,
              timingScope: 'wall'
            },
            {
              step: 'llm',
              provider: 'groq',
              model: 'openai/gpt-oss-120b',
              processingTimeMs: 6000,
              msPerUnit: 300,
              throughputValue: 3.33,
              throughputUnit: 'KTokensPerSecond',
              rateBasis: '1KTokens',
              inputMetric: 'tokens',
              inputValue: 12000,
              timingScope: 'wall'
            },
            {
              step: 'llm',
              provider: 'minimax',
              model: 'MiniMax-M3',
              processingTimeMs: 2500,
              msPerUnit: 700,
              throughputValue: 1.43,
              throughputUnit: 'KTokensPerSecond',
              rateBasis: '1KTokens',
              inputMetric: 'tokens',
              inputValue: 3500,
              timingScope: 'wall'
            }
          ]
        }
      }
  })
}

describe('text benchmark contracts', () => {
  test('benchmark --text writes metadata-only comparison reports for write runs', async () => {
    const runDir = await makeTempRoot('autoshow-text-benchmark-')
    await writeTextRun(runDir)

    await runTextBenchmark(runDir, textBenchmarkFlags)

    const comparison = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
      kind: string
      category: string
      qualityPolicy: string
      providerGroups: {
        local: {
          count: number
          providers: Array<{
            providerKey: string
            costCents: number
            msPerUnit: number
            inputTokenCount: number
            outputTokenCount: number
            outputExists: boolean
          }>
        }
        service: {
          count: number
          providers: Array<{
            providerKey: string
            costCents: number
            msPerUnit: number
            inputTokenCount: number
            outputTokenCount: number
            providerUsage: Record<string, unknown>
            rawProviderUsage: Record<string, unknown> | null
          }>
        }
      }
      rankingSurfaces: {
        local: {
          price: Array<{ providerKey: string, value: number | null }>
          speed: Array<{ providerKey: string, metric: string, value: number | null }>
          automatedQuality: unknown[]
          automatedQualityUnavailableReason: string | null
        }
        service: {
          price: Array<{ providerKey: string, value: number | null }>
          speed: Array<{ providerKey: string, metric: string, value: number | null }>
          automatedQuality: unknown[]
          automatedQualityUnavailableReason: string | null
          humanQuality: unknown[]
          humanQualityUnavailableReason: string | null
        }
      }
    }

    expect(comparison.kind).toBe('text-provider-comparison')
    expect(comparison.category).toBe('text')
    expect(comparison.providerGroups.local.count).toBe(1)
    expect(comparison.providerGroups.service.count).toBe(2)
    expect(comparison.providerGroups.local.providers[0]).toMatchObject({
      providerKey: 'llama.cpp/Meta-Llama-3.1-8B-Instruct-Q4_K_M',
      costCents: 0,
      msPerUnit: 800,
      inputTokenCount: 2000,
      outputTokenCount: 1000,
      outputExists: true
    })

    const groqProvider = comparison.providerGroups.service.providers.find((provider) => provider.providerKey === 'groq/openai/gpt-oss-120b')
    expect(groqProvider).toMatchObject({
      costCents: 1.2,
      msPerUnit: 300,
      inputTokenCount: 10000,
      outputTokenCount: 2000
    })
    expect(groqProvider?.providerUsage['total_tokens']).toBe(12000)
    expect(groqProvider?.rawProviderUsage?.['queue_time']).toBe(0.01)

    expect(comparison.rankingSurfaces.local.price).toHaveLength(1)
    expect(comparison.rankingSurfaces.local.price[0]).toMatchObject({
      providerKey: 'llama.cpp/Meta-Llama-3.1-8B-Instruct-Q4_K_M',
      value: 0
    })
    expect(comparison.rankingSurfaces.service.price.map((entry) => entry.providerKey)).toEqual([
      'groq/openai/gpt-oss-120b',
      'minimax/MiniMax-M3'
    ])
    expect(comparison.rankingSurfaces.service.speed.map((entry) => [entry.providerKey, entry.metric, entry.value])).toEqual([
      ['groq/openai/gpt-oss-120b', 'msPerUnit', 300],
      ['minimax/MiniMax-M3', 'msPerUnit', 700]
    ])
    expect(comparison.rankingSurfaces.service.automatedQuality).toEqual([])
    expect(comparison.rankingSurfaces.service.humanQuality).toEqual([])
    expect(comparison.rankingSurfaces.service.automatedQualityUnavailableReason).toContain('not inferred')
    expect(comparison.rankingSurfaces.service.humanQualityUnavailableReason).toContain('not inferred')
    expect(comparison.qualityPolicy).toContain('Length, speed, cost')

    const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(markdown).toContain('# Text Provider Comparison Report')
    expect(markdown).toContain('300.000 ms/1K tokens')
    expect(markdown).toContain('Text quality is not inferred')
  })
})

const videoJudgeOutput = (score: number, summary: string): Record<string, unknown> => ({
  output_text: JSON.stringify({
    promptAdherence: score,
    visualQuality: score,
    artifactControl: score,
    temporalConsistency: score,
    compositionCamera: score,
    summary,
    strengths: [`score ${score} strength`],
    issues: score >= 8 ? [] : ['visible weakness']
  }),
  usage: {
    input_tokens: 120,
    output_tokens: 40
  }
})

const writeTinyVideo = async (path: string): Promise<void> => {
  if (!Bun.which('ffmpeg') || !Bun.which('ffprobe')) {
    throw new Error('ffmpeg and ffprobe are required for video benchmark contract coverage')
  }

  const result = await exec('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'lavfi',
    '-i', 'testsrc2=size=32x32:rate=10',
    '-t', '1',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y',
    path
  ])
  if (result.exitCode !== 0) {
    throw new Error(`failed to create tiny video fixture: ${result.stderr}`)
  }
}

const writeVideoRun = async (runDir: string): Promise<void> => {
  await mkdir(runDir, { recursive: true })
  await writeTinyVideo(join(runDir, 'grok.mp4'))
  await writeSingleManifestFixture(runDir, 'video', {
      input: 'A cinematic mountain sunrise with a slow forward camera move.',
      video: [
        {
          videoGenService: 'grok',
          videoGenModel: 'grok-imagine-video',
          processingTime: 1250,
          videoFileName: 'grok.mp4',
          videoFileSize: 1024,
          videoDuration: 1
        }
      ],
      cost: {
        actual: {
          totalCost: 20,
          steps: [
            {
              step: 'video',
              provider: 'grok',
              model: 'grok-imagine-video',
              cost: 20
            }
          ]
        }
      }
  })
}

const videoBenchmarkFlags: BenchmarkFlags = {
  video: true,
  bitrates: '',
  speeds: '',
  'reference-stt': '',
  'skip-compression': false,
  'skip-speed': false,
  'video-judge-model': 'gpt-5.5'
}

describe('video benchmark contracts', () => {
  test('benchmark --video sends one Responses vision judge request per video and writes quality reports', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'

    const calls = installFetch(() => jsonResponse(videoJudgeOutput(8, 'Strong prompt match with coherent camera motion.')))

    const runDir = await makeTempRoot('autoshow-video-benchmark-')
    await writeVideoRun(runDir)

    await runVideoBenchmark(runDir, videoBenchmarkFlags)

    expect(calls).toHaveLength(1)
    const firstCall = calls[0]
    expect(firstCall).toBeDefined()
    if (!firstCall) throw new Error('expected first fetch call')

    const firstBody = firstCall.bodyJson as MediaBenchmarkRequestBody | undefined
    expect(firstCall.url).toBe('https://api.openai.com/v1/responses')
    expect(firstCall.method).toBe('POST')
    expect(firstCall.headers.get('authorization')).toBe('Bearer openai-key')
    expect(firstBody?.model).toBe('gpt-5.5')
    expect(firstBody?.text?.format).toMatchObject({
      type: 'json_schema',
      name: 'video_quality_evaluation',
      strict: true
    })

    const content = firstBody?.input?.[0]?.content ?? []
    const imageParts = content.filter((part) => part['type'] === 'input_image')
    expect(imageParts).toHaveLength(10)
    expect(imageParts.every((part) => part['detail'] === 'auto')).toBe(true)
    expect(imageParts.every((part) => String(part['image_url']).startsWith('data:image/png;base64,'))).toBe(true)

    const qualityReport = await Bun.file(join(runDir, 'video-quality-report.json')).json() as {
      frameCount: number
      providers: Array<{
        providerKey: string
        qualityScore: number
        videos: Array<{
          frameCount: number
          frames: Array<{ timestampSeconds: number, fileName: string }>
          criterionScores: { temporalConsistency: number }
        }>
      }>
    }
    expect(Object.keys(qualityReport)).toEqual([
      'schemaVersion', 'kind', 'runDir', 'runName', 'generatedAt', 'judge', 'prompt', 'rubric', 'providerCount', 'videoCount', 'frameCount', 'providers'
    ])
    expect(Object.keys(qualityReport.providers[0] ?? {})).toEqual([
      'rank', 'providerKey', 'provider', 'model', 'group', 'videoFiles', 'videoCount', 'processingTimeMs', 'costCents',
      'criterionScores', 'averageScore10', 'qualityScore', 'qualityMetric', 'evidence', 'videos'
    ])
    expect(qualityReport.frameCount).toBe(10)
    expect(qualityReport.providers.map((provider) => provider.providerKey)).toEqual(['grok/grok-imagine-video'])
    expect(qualityReport.providers[0]?.qualityScore).toBe(80)
    expect(qualityReport.providers[0]?.videos[0]?.frameCount).toBe(10)
    expect(qualityReport.providers[0]?.videos[0]?.criterionScores.temporalConsistency).toBe(8)
    expect(qualityReport.providers[0]?.videos[0]?.frames[0]?.timestampSeconds).toBeCloseTo(0.05, 2)
    expect(qualityReport.providers[0]?.videos[0]?.frames[9]?.timestampSeconds).toBeCloseTo(0.95, 2)

    const firstFrame = qualityReport.providers[0]?.videos[0]?.frames[0]?.fileName
    expect(firstFrame).toBeDefined()
    if (!firstFrame) throw new Error('expected first extracted frame')
    expect(await Bun.file(join(runDir, firstFrame)).exists()).toBe(true)

    const comparison = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
      providerGroups: {
        service: {
          providers: Array<{
            providerKey: string
            costCents: number
            qualityScore: number
            qualityMetric: string
            metrics: { qualityScore: number }
            videoQuality: {
              evidence: {
                judgeModel: string
                frameCount: number
                summary: string
                criterionScores: { promptAdherence: number }
              }
            }
          }>
        }
      }
      rankingSurfaces: {
        service: {
          automatedQuality: Array<{ providerKey: string, value: number | null }>
          highestQuality: Array<{ providerKey: string, value: number | null }>
        }
      }
    }
    const grokProvider = comparison.providerGroups.service.providers.find((provider) => provider.providerKey === 'grok/grok-imagine-video')
    expect(grokProvider?.costCents).toBe(20)
    expect(grokProvider?.qualityScore).toBe(80)
    expect(grokProvider?.qualityMetric).toBe('video quality score')
    expect(grokProvider?.metrics.qualityScore).toBe(80)
    expect(grokProvider?.videoQuality.evidence.judgeModel).toBe('gpt-5.5')
    expect(grokProvider?.videoQuality.evidence.frameCount).toBe(10)
    expect(grokProvider?.videoQuality.evidence.criterionScores.promptAdherence).toBe(8)
    expect(grokProvider?.videoQuality.evidence.summary).toContain('Strong prompt match')
    expect(comparison.rankingSurfaces.service.automatedQuality[0]).toMatchObject({
      providerKey: 'grok/grok-imagine-video',
      value: 80
    })
    expect(comparison.rankingSurfaces.service.highestQuality).toEqual(comparison.rankingSurfaces.service.automatedQuality)

    const qualityMarkdown = await Bun.file(join(runDir, 'video-quality-report.md')).text()
    const comparisonMarkdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
    expect(qualityMarkdown).toContain('# Video Quality Report')
    expect(comparisonMarkdown).toContain('### Automated Quality')
    expect(comparisonMarkdown).toContain('80.00/100')
  })
})

describe('vision benchmark provider evidence policy', () => {
  test('keeps first-entry evidence distinct from averaged evidence', async () => {
    const entries = [
      { service: 'provider', model: 'model', processingTimeMs: 100, costCents: 2, artifact: 'first' },
      { service: 'provider', model: 'model', processingTimeMs: 300, costCents: 4, artifact: 'second' }
    ]
    const resolve = async (statsPolicy: 'first' | 'average') => await resolveVisionProviders({
      entries,
      identity: ({ service, model }) => ({ service, model }),
      stats: ({ processingTimeMs, costCents }) => ({ processingTimeMs, costCents }),
      artifacts: ({ artifact }) => Promise.resolve([artifact]),
      statsPolicy,
      assemble: (base, artifacts) => ({ ...base, artifacts })
    })

    expect(await resolve('first')).toEqual([{
      providerKey: 'provider/model', provider: 'provider', model: 'model', group: 'service',
      processingTimeMs: 100, costCents: 2, artifacts: ['first', 'second']
    }])
    expect(await resolve('average')).toEqual([{
      providerKey: 'provider/model', provider: 'provider', model: 'model', group: 'service',
      processingTimeMs: 200, costCents: 3, artifacts: ['first', 'second']
    }])
  })
})
