import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildModelCalibrationReport } from '../../../../test-runner/model-calibration'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const tempDirs: string[] = []

const canonicalManifest = (
  command: string,
  metadata: Record<string, unknown>,
  options: {
    extractRoute?: 'media' | 'document'
    providers?: Record<string, unknown>[]
  } = {}
) => ({
  command,
  scope: 'single',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  items: [{
    ...(options.extractRoute ? { extractRoute: options.extractRoute } : {}),
    status: 'full',
    metadata,
    providers: options.providers ?? []
  }]
})

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('test-runner contracts', () => {
  test('model calibration scans copied canonical manifests and reports recommendations', async () => {
      const dir = await makeTempDir('autoshow-calibration-run-manifest-')
      tempDirs.push(dir)

      const configPath = join(dir, 'image-config.json')
      await writeFile(configPath, `${JSON.stringify({
        openai: {
          description: 'OpenAI image generation',
          type: 'api',
          models: {
            'gpt-image-2': {
              description: 'GPT Image 2',
              costPerImageCents: 8,
              estimation: {
                costMultiplier: 1,
                msPerImage: 1000
              }
            }
          }
        }
      }, null, 2)}\n`)
      const originalConfig = await readFile(configPath, 'utf8')

      const runDir = join(dir, '2026-05-01_00-00-00_test-run')
      const copiedRunDir = join(runDir, 'run')
      await mkdir(copiedRunDir, { recursive: true })
      await writeFile(join(copiedRunDir, '2026-05-01_00-00-01_image-gen.json'), `${JSON.stringify(canonicalManifest('image', {
          cost: {
            estimated: {
              steps: [{
                step: 'image',
                provider: 'openai',
                model: 'gpt-image-2',
                cost: 2,
                costMultiplier: 1
              }]
            },
            actual: {
              steps: [{
                step: 'image',
                provider: 'openai',
                model: 'gpt-image-2',
                cost: 2,
                inputMetric: 'images',
                inputValue: 1
              }]
            }
          },
          timing: {
            actual: {
              steps: [{
                step: 'image',
                provider: 'openai',
                model: 'gpt-image-2',
                processingTimeMs: 3000,
                msPerUnit: 1800,
                timingScope: 'wall',
                inputMetric: 'images',
                inputValue: 1
              }]
            }
          }
      }), null, 2)}\n`)

      const report = await buildModelCalibrationReport(dir, { image: configPath })
      const configAfterCalibration = await readFile(configPath, 'utf8')

      expect(report.runsScanned).toBe(1)
      expect(report.metadataFilesScanned).toBe(1)
      expect(report.recommendedModels).toBe(1)
      expect(configAfterCalibration).toBe(originalConfig)
      expect(report.recommendations[0]?.timeSamples).toBe(1)
      expect(report.recommendations[0]?.medianTimeValue).toBe(1800)
      expect(report.recommendations[0]?.recommendedTimeValue).toBe(1280)
      expect(report.recommendations[0]?.recommendedCostMultiplier).toBeNull()
      expect(report.recommendations[0]?.notes).toEqual(['Timing calibration uses wall-clock latency observations.'])
    })

  test('model calibration reads split STT provider fragments without writing back', async () => {
      const dir = await makeTempDir('autoshow-calibration-stt-fragment-')
      tempDirs.push(dir)

      const runsRoot = join(dir, 'runs')
      const configDir = join(dir, 'config', 'stt-config')
      await mkdir(configDir, { recursive: true })
      const deepgramConfigPath = join(configDir, 'stt-deepgram.json')
      const mistralConfigPath = join(configDir, 'stt-mistral.json')

      await writeFile(deepgramConfigPath, `${JSON.stringify({
        deepgram: {
          description: 'Deepgram transcription',
          type: 'api',
          models: {
            'nova-3': {
              description: 'Nova 3',
              costPerHourCents: 27,
              estimation: {
                costMultiplier: 1,
                msPerSecond: 1000
              }
            }
          }
        }
      }, null, 2)}\n`)
      await writeFile(mistralConfigPath, `${JSON.stringify({
        mistral: {
          description: 'Mistral transcription',
          type: 'api',
          models: {
            'voxtral-mini-2602': {
              description: 'Voxtral Mini',
              costPerHourCents: 36,
              estimation: {
                costMultiplier: 1,
                msPerSecond: 2000
              }
            }
          }
        }
      }, null, 2)}\n`)
      const originalDeepgramConfig = await readFile(deepgramConfigPath, 'utf8')
      const originalMistralConfig = await readFile(mistralConfigPath, 'utf8')

      const runDir = join(runsRoot, '2026-05-01_00-00-00_test-run')
      const copiedRunDir = join(runDir, 'run')
      await mkdir(copiedRunDir, { recursive: true })
      await writeFile(join(copiedRunDir, '2026-05-01_00-00-01_stt.json'), `${JSON.stringify(canonicalManifest('extract', {
          timing: {
            actual: {
              steps: [{
                step: 'stt',
                provider: 'deepgram',
                model: 'nova-3',
                processingTimeMs: 3000,
                inputMetric: 'durationSeconds',
                inputValue: 1
              }]
            }
          }
      }, {
        extractRoute: 'media',
        providers: [{
          service: 'deepgram',
          model: 'nova-3',
          artifactDir: 'providers/deepgram-nova-3',
          status: 'succeeded',
          attempts: 1,
          options: {},
          metadata: { transcriptionService: 'deepgram', transcriptionModel: 'nova-3', processingTime: 3000 }
        }]
      }), null, 2)}\n`)

      const report = await buildModelCalibrationReport(runsRoot, { stt: configDir })

      expect(report.runsScanned).toBe(1)
      expect(report.metadataFilesScanned).toBe(1)
      expect(report.recommendedModels).toBe(1)
      expect(await readFile(deepgramConfigPath, 'utf8')).toBe(originalDeepgramConfig)
      expect(await readFile(mistralConfigPath, 'utf8')).toBe(originalMistralConfig)
      expect(report.recommendations[0]?.kind).toBe('stt')
      expect(report.recommendations[0]?.service).toBe('deepgram')
      expect(report.recommendations[0]?.model).toBe('nova-3')
      expect(report.recommendations[0]?.oldTimeValue).toBe(1000)
      expect(report.recommendations[0]?.recommendedTimeValue).toBe(1500)
    })

  test('model calibration reads split OCR provider fragments without writing back', async () => {
      const dir = await makeTempDir('autoshow-calibration-ocr-fragment-')
      tempDirs.push(dir)

      const runsRoot = join(dir, 'runs')
      const configDir = join(dir, 'config', 'ocr-config')
      await mkdir(configDir, { recursive: true })
      const mistralConfigPath = join(configDir, 'ocr-mistral.json')
      const openaiConfigPath = join(configDir, 'ocr-openai.json')

      await writeFile(mistralConfigPath, `${JSON.stringify({
        mistral: {
          description: 'Mistral OCR',
          type: 'api',
          models: {
            'mistral-ocr-4-0': {
              description: 'Mistral OCR 4.0',
              costPer1kPagesCents: 100,
              estimation: {
                costMultiplier: 1,
                msPerPage: 1000
              }
            }
          }
        }
      }, null, 2)}\n`)
      await writeFile(openaiConfigPath, `${JSON.stringify({
        openai: {
          description: 'OpenAI OCR',
          type: 'api',
          models: {
            'gpt-4o-mini': {
              description: 'GPT-4o mini',
              costPerMInputTokensCents: 15,
              costPerMOutputTokensCents: 60,
              estimation: {
                costMultiplier: 1,
                msPerPage: 2000
              }
            }
          }
        }
      }, null, 2)}\n`)
      const originalMistralConfig = await readFile(mistralConfigPath, 'utf8')
      const originalOpenaiConfig = await readFile(openaiConfigPath, 'utf8')

      const runDir = join(runsRoot, '2026-05-01_00-00-00_test-run')
      const copiedRunDir = join(runDir, 'run')
      await mkdir(copiedRunDir, { recursive: true })
      await writeFile(join(copiedRunDir, '2026-05-01_00-00-01_extract.json'), `${JSON.stringify(canonicalManifest('extract', {
          timing: {
            actual: {
              steps: [{
                step: 'extract',
                provider: 'mistral',
                model: 'mistral-ocr-4-0',
                processingTimeMs: 4500,
                inputMetric: 'pages',
                inputValue: 3
              }]
            }
          }
      }, {
        extractRoute: 'document',
        providers: [{
          service: 'mistral',
          model: 'mistral-ocr-4-0',
          artifactDir: 'providers/mistral-mistral-ocr-4-0',
          status: 'succeeded',
          attempts: 1,
          options: {},
          metadata: { ocrService: 'mistral', ocrModel: 'mistral-ocr-4-0', processingTime: 4500 }
        }]
      }), null, 2)}\n`)

      const report = await buildModelCalibrationReport(runsRoot, { extract: configDir })

      expect(report.runsScanned).toBe(1)
      expect(report.metadataFilesScanned).toBe(1)
      expect(report.recommendedModels).toBe(1)
      expect(await readFile(mistralConfigPath, 'utf8')).toBe(originalMistralConfig)
      expect(await readFile(openaiConfigPath, 'utf8')).toBe(originalOpenaiConfig)
      expect(report.recommendations[0]?.kind).toBe('extract')
      expect(report.recommendations[0]?.service).toBe('mistral')
      expect(report.recommendations[0]?.model).toBe('mistral-ocr-4-0')
      expect(report.recommendations[0]?.oldTimeValue).toBe(1000)
      expect(report.recommendations[0]?.medianTimeValue).toBe(1500)
      expect(report.recommendations[0]?.recommendedTimeValue).toBe(1175)
    })
})
