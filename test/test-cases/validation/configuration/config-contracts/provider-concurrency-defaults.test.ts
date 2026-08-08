import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'

describe('config provider and concurrency default contracts', () => {
  test('buildConfigPatchFromFlags maps explicit provider, OCR, batch, and pricing defaults', () => {
    expect(buildConfigPatchFromFlags({
      openai: 'gpt-5.4-mini',
      grok: 'grok-4.3',
      glm: 'glm-5.1',
      kimi: 'kimi-k2.6',
      together: ['kimi-k2.6', 'glm-5.1'],
      cerebras: ['gpt-oss-120b', 'zai-glm-4.7'],
      'llm-provider-concurrency': '3',
      'llm-local-concurrency': '1',
      'tesseract-ocr': true,
      'openai-ocr': ['gpt-5.5'],
      'grok-ocr': ['grok-4.3'],
      'deepinfra-ocr': ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
      'kimi-ocr': ['kimi-k2.6'],
      'ocr-dpi': '450',
      'ocr-concurrency': '5',
      'ocr-provider-concurrency': '4',
      'ocr-local-concurrency': '2',
      'batch-limit': '7',
      'max-cents': '25'
    }, new Set(['openai', 'grok', 'glm', 'kimi', 'together', 'cerebras', 'llm-provider-concurrency', 'llm-local-concurrency', 'tesseract-ocr', 'openai-ocr', 'grok-ocr', 'deepinfra-ocr', 'kimi-ocr', 'ocr-dpi', 'ocr-concurrency', 'ocr-provider-concurrency', 'ocr-local-concurrency', 'batch-limit', 'max-cents']))).toEqual({
      defaults: {
        llm: {
          openai: ['gpt-5.4-mini'],
          grok: ['grok-4.3'],
          glm: ['glm-5.1'],
          kimi: ['kimi-k2.6'],
          together: ['kimi-k2.6', 'glm-5.1'],
          cerebras: ['gpt-oss-120b', 'zai-glm-4.7'],
          providerConcurrency: 3,
          localConcurrency: 1
        },
        extract: {
          ocr: {
            tesseract: true,
            openaiOcr: ['gpt-5.5'],
            grokOcr: ['grok-4.3'],
            deepinfraOcr: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
            kimiOcr: ['kimi-k2.6'],
            dpi: 450,
            pageConcurrency: 5,
            providerConcurrency: 4,
            localConcurrency: 2
          }
        },
        batch: {
          limit: 7
        }
      },
      pricing: {
        maxCents: 25
      }
    })
  })

  test('buildConfigPatchFromFlags saves generation provider concurrency defaults', () => {
    expect(buildConfigPatchFromFlags({
      'tts-provider-concurrency': '4',
      'tts-local-concurrency': '1',
      'tts-chunk-concurrency': '3',
      'image-provider-concurrency': '5',
      'image-local-concurrency': '1',
      'video-provider-concurrency': '6',
      'video-local-concurrency': '1',
      'music-provider-concurrency': '7',
      'music-local-concurrency': '1'
    }, new Set([
      'tts-provider-concurrency',
      'tts-local-concurrency',
      'tts-chunk-concurrency',
      'image-provider-concurrency',
      'image-local-concurrency',
      'video-provider-concurrency',
      'video-local-concurrency',
      'music-provider-concurrency',
      'music-local-concurrency'
    ]))).toEqual({
      defaults: {
        post: {
          tts: {
            providerConcurrency: 4,
            localConcurrency: 1,
            chunkConcurrency: 3
          },
          image: {
            providerConcurrency: 5,
            localConcurrency: 1
          },
          video: {
            providerConcurrency: 6,
            localConcurrency: 1
          },
          music: {
            providerConcurrency: 7,
            localConcurrency: 1
          }
        }
      }
    })
  })

  test('TTS chunk concurrency round-trips through saved config flags', () => {
    const patch = buildConfigPatchFromFlags({
      'tts-chunk-concurrency': '4'
    }, new Set(['tts-chunk-concurrency']))

    expect(patch).toEqual({
      defaults: {
        post: {
          tts: {
            chunkConcurrency: 4
          }
        }
      }
    })
    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'tts-chunk-concurrency': '4'
    })
  })

  test('OCR page concurrency round-trips through saved config flags', () => {
    const patch = buildConfigPatchFromFlags({
      'ocr-concurrency': '4'
    }, new Set(['ocr-concurrency']))

    expect(patch).toEqual({
      defaults: {
        extract: {
          ocr: {
            pageConcurrency: 4
          }
        }
      }
    })
    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'ocr-concurrency': '4'
    })
  })

  test('URL article provider defaults save and merge through defaults.extract.url.provider', () => {
    const patch = buildConfigPatchFromFlags({
      'url-provider': 'zyte'
    }, new Set(['url-provider']))

    expect(patch).toEqual({
      defaults: {
        extract: {
          url: {
            provider: 'zyte'
          }
        }
      }
    })
    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject({
      'url-provider': 'zyte'
    })
    expect(mergeConfigIntoRawFlags({
      'url-provider': 'firecrawl'
    }, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set(['url-provider']))).toMatchObject({
      'url-provider': 'firecrawl'
    })
    expect(mergeConfigIntoRawFlags({
      'all-url': true
    }, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set(['all-url']))).not.toHaveProperty('url-provider')
  })
})
