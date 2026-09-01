import { describe, expect, test } from 'bun:test'
import { configureModelCostFilter, filterModelCostTargets } from '~/cli/commands/pricing-orchestration/model-cost-filter'
import type { AggregatedPriceEstimate } from '~/types'
import { stripAnsi } from '~/utils/terminal-colors'
import { runCommand, STABLE_TTS_MD_PATH } from '../../test-utils/test-helpers'

describe('--max-model-cents', () => {
  test('sums each provider/model across a batch before applying the ceiling', () => {
    const options = { maxModelCents: 400 }
    const estimates: AggregatedPriceEstimate[] = [
      {
        steps: [
          { step: 'image', provider: 'openai', model: 'expensive', imageCount: 1, totalCost: 250 },
          { step: 'image', provider: 'fal', model: 'cheap', imageCount: 1, totalCost: 100 }
        ],
        totalEstimatedCost: 350
      },
      {
        steps: [
          { step: 'image', provider: 'openai', model: 'expensive', imageCount: 1, totalCost: 250 },
          { step: 'image', provider: 'fal', model: 'cheap', imageCount: 1, totalCost: 100 }
        ],
        totalEstimatedCost: 350
      }
    ]

    configureModelCostFilter(options, estimates)

    expect(filterModelCostTargets([
      { service: 'openai', model: 'expensive' },
      { service: 'fal', model: 'cheap' }
    ], options, 'image')).toEqual([{ service: 'fal', model: 'cheap' }])
  })

  test('filters TTS price output and expected artifacts without provider calls', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      STABLE_TTS_MD_PATH,
      '--all-providers',
      '--max-model-cents',
      '0.5',
      '--price'
    ])
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`)

    expect(result.exitCode).toBe(0)
    expect(output).toContain('Excluded')
    expect(output).toContain('speechify')
    expect(output).not.toContain('speech-hume-octave-1.wav')
    expect(output).not.toContain('speech-elevenlabs-eleven_v3.wav')
  })

  test('filters image targets and expected artifacts in price mode', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'image',
      'a test image',
      '--all-providers',
      '--max-model-cents',
      '1',
      '--price'
    ])
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`)

    expect(result.exitCode).toBe(0)
    expect(output).toContain('fal-ai-hidream-o1-image')
    expect(output).toContain('alibaba-qwen-image-3')
    expect(output).not.toContain('generated-image-openai-gpt-image-2.png')
  })

  test('filters video targets and expected artifacts in price mode', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a test video',
      '--all-providers',
      '--max-model-cents',
      '100',
      '--price'
    ])
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`)

    expect(result.exitCode).toBe(0)
    expect(output).toContain('generated-video-gemini-veo-3.1-fast-generate-preview.mp4')
    expect(output).not.toContain('generated-video-gemini-veo-3.1-generate-preview.mp4')
    expect(output).not.toContain('generated-video-fal-minimax-h3.mp4')
  })

  test('filters music targets and expected artifacts in price mode', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'music',
      'a test song',
      '--all-providers',
      '--max-model-cents',
      '10',
      '--price'
    ])
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`)

    expect(result.exitCode).toBe(0)
    expect(output).toContain('gemini')
    expect(output).toContain('generated-music.mp3')
    expect(output).not.toContain('generated-music-elevenlabs-music_v2.mp3')
    expect(output).not.toContain('generated-music-minimax-music-3.0.mp3')
  })

  test('filters LLM rows in write price mode', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      STABLE_TTS_MD_PATH,
      '--all-providers',
      '--max-model-cents',
      '0.5',
      '--price'
    ])
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`)
    const estimateOutput = output.slice(output.indexOf('Estimate'))

    expect(result.exitCode).toBe(0)
    expect(estimateOutput).toContain('gpt-5.6-luna')
    expect(estimateOutput).toContain('openai/gpt-oss-20b')
    expect(estimateOutput).not.toContain('claude-opus')
    expect(estimateOutput).not.toContain('gpt-5.6-sol')
  })

  test('filters STT rows in extract price mode', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      'input/examples/audio/0-audio-short.mp3',
      '--all-providers',
      '--max-model-cents',
      '0.05',
      '--price'
    ])
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`)
    const estimateOutput = output.slice(output.indexOf('Estimate'))

    expect(result.exitCode).toBe(0)
    expect(estimateOutput).toContain('deepinfra')
    expect(estimateOutput).not.toContain('happyscribe')
    expect(estimateOutput).not.toContain('gladia')
  })

  test('fails safely when the ceiling excludes every selected target', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'music',
      'a test song',
      '--all-providers',
      '--max-model-cents',
      '0',
      '--price'
    ])
    const output = stripAnsi(`${result.stdout}\n${result.stderr}`)

    expect(result.exitCode).toBe(2)
    expect(output).toContain('excludes every music provider/model target')
  })

  test('rejects nonnumeric ceilings as usage errors', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      STABLE_TTS_MD_PATH,
      '--max-model-cents',
      'not-a-number',
      '--price'
    ])

    expect(result.exitCode).toBe(2)
    expect(stripAnsi(`${result.stdout}\n${result.stderr}`)).toContain('Invalid --max-model-cents value "not-a-number"')
  })
})
