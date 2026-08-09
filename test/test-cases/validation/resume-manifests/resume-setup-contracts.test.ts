import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runCommand } from '../../../test-utils/test-helpers'
import { readRunManifest, writeExtractBatchManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { writeOcrRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-manifest'
import { writeSttRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-manifest'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import type { Step3Metadata } from '~/types'

const tempDirs: string[] = []

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const writeCompleteTtsRun = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true })
  await writeRunManifest(dir, 'tts', {
    input: 'Hello.',
    requestedProviders: [{ service: 'kitten', model: 'kitten-tts-nano' }],
    tts: [{
      ttsService: 'kitten',
      ttsModel: 'kitten-tts-nano',
      processingTime: 1,
      audioFileName: 'speech.wav',
      audioFileSize: 1,
      chunkCount: 1
    }]
  })
}

const writeIncompleteTtsRun = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true })
  await writeRunManifest(dir, 'tts', {
    input: 'Hello from resume price mode.',
    requestedProviders: [
      { service: 'kitten', model: 'kitten-tts-nano' },
      { service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }
    ],
    tts: [{
      ttsService: 'kitten',
      ttsModel: 'kitten-tts-nano',
      processingTime: 1,
      audioFileName: 'speech.wav',
      audioFileSize: 1,
      chunkCount: 1
    }]
  })
}

const writeWriteRun = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true })
  await writeRunManifest(dir, 'write', {
    step3: {
      llmService: 'openai',
      llmModel: 'gpt-5.5',
      processingTime: 1,
      inputTokenCount: 1200,
      outputTokenCount: 240,
      outputFileName: 'text-gpt-5.5.json',
      outputFormat: 'json',
      structuredMode: 'native',
      structuredPresetNames: ['shortSummary']
    } satisfies Step3Metadata
  })
  await Bun.write(join(dir, 'prompt.md'), 'Stored prompt for resume pricing.')
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

test('resume surface is reachable through help', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'resume', '--help'], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('bun autoshow resume')
  expect(result.stdout).toContain('<outputDirs...>')
  expect(result.stdout).toContain('--provider')
  expect(result.stdout).toContain('--tts-voice')
  expect(result.stdout).not.toContain('--refresh-cache')
  expect(result.stdout).not.toContain('--no-cache')
})

test('resume requires an explicit output directory', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'resume'], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Missing required parameter: outputDirs')
})

test('resume rejects a missing output directory before reaching provider validation', async () => {
  const missingDir = join(tmpdir(), `autoshow-missing-resume-${Date.now()}`)
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    missingDir,
    '--provider',
    'deepgram=not-a-deepgram-model'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Could not find')
})

test('resume loudly rejects schemaVersion 2 manifests after the clean break', async () => {
  const runDir = await makeTempRoot('autoshow-old-resume-manifest-')
  const runPath = join(runDir, 'run.json')
  await Bun.write(runPath, JSON.stringify({
    schemaVersion: 2,
    kind: 'extract',
    metadata: { extractRoute: 'media' }
  }))

  const result = await runCommand(['src/cli/create-cli.ts', 'resume', runDir], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(output).toContain(`Unsupported manifest version at ${runPath}`)
  expect(output).toContain('found schemaVersion 2')
  expect(output).toContain('supports schemaVersion 3')
  expect(output).toContain('Old runs are not resumable with this build — re-run the pipeline.')
  expect(output).not.toContain('Could not find extract-batch.json, batch.json, or run.json')
})

test('resume reports that X-Space extract runs are not resumable', async () => {
  const runDir = await makeTempRoot('autoshow-x-space-resume-')
  await writeRunManifest(runDir, 'extract', {
    extractRoute: 'x-space',
    source: { url: 'https://x.com/i/spaces/1DXxyRYNejbKM' }
  })

  const result = await runCommand(['src/cli/create-cli.ts', 'resume', runDir], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(output).toContain('X-Space runs are not resumable. Re-run the pipeline instead.')
  expect(output).not.toContain('not a URL article extract run')
})

test('resume reports that parent batches containing X-Space runs are not resumable', async () => {
  const batchDir = await makeTempRoot('autoshow-x-space-parent-resume-')
  await writeExtractBatchManifest(batchDir, {
    schemaVersion: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    childBatches: { 'x-space': 'x-space' },
    items: [{
      input: 'https://x.com/i/spaces/1DXxyRYNejbKM',
      inputFamily: 'x_space',
      extractRoute: 'x-space',
      childBatchEntry: { route: 'x-space', index: 0 },
      completionStatus: 'full',
      outputDir: 'x-space-output'
    }]
  })

  const result = await runCommand(['src/cli/create-cli.ts', 'resume', batchDir], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(output).toContain('X-Space runs are not resumable. Re-run the pipeline instead.')
})

test('resume reports every missing output directory', async () => {
  const root = await makeTempRoot('autoshow-missing-resume-many-')
  const missingOne = join(root, 'missing-one')
  const missingTwo = join(root, 'missing-two')
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    missingOne,
    missingTwo
  ], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(output).toContain(missingOne)
  expect(output).toContain(missingTwo)
  expect(output).toContain('Resume failed for 2 output directories')
})

test('multi-directory resume failures use staged infrastructure errors', async () => {
  const root = await makeTempRoot('autoshow-missing-resume-error-')
  const missingOne = join(root, 'missing-one')
  const missingTwo = join(root, 'missing-two')

  try {
    await dispatchResume([missingOne, missingTwo], {}, [], [])
    expect.unreachable('missing resume directories should fail')
  } catch (error) {
    expect(error).toMatchObject({
      kind: 'infrastructure',
      stage: 'resume:dispatch',
      exitCode: 2
    })
    expect((error as Error).message).toContain('Resume failed for 2 output directories')
  }
})

test('resume continues after a failed directory and summarizes at the end', async () => {
  const root = await makeTempRoot('autoshow-mixed-resume-')
  const missingDir = join(root, 'missing')
  const completeRunDir = join(root, 'complete-tts')
  await writeCompleteTtsRun(completeRunDir)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    missingDir,
    completeRunDir
  ], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(output).toContain(missingDir)
  expect(output).toContain(completeRunDir)
  expect(output).toContain('all providers already complete')
  expect(output).toContain('Resume failed for 1 output directory')
})

test('multi-directory resume labels single-run items and logs a suite summary', async () => {
  const root = await makeTempRoot('autoshow-multi-resume-labels-')
  const firstRunDir = join(root, 'first-complete-tts')
  const secondRunDir = join(root, 'second-complete-tts')
  await writeCompleteTtsRun(firstRunDir)
  await writeCompleteTtsRun(secondRunDir)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    firstRunDir,
    secondRunDir
  ], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('1/2')
  expect(output).toContain('2/2')
  expect(output).toContain('Resume Suite Summary')
  expect(output).toContain('directories')
})

test('explicit OCR resume succeeds when selected providers are complete and manifest remains incomplete', async () => {
  const root = await makeTempRoot('autoshow-ocr-selected-complete-')
  const runDir = join(root, 'ocr-run')
  await mkdir(runDir, { recursive: true })
  await writeOcrRunManifest(runDir, {
    source: { filePath: '/tmp/document.pdf' },
    completionStatus: 'incomplete',
    requestedProviders: [
      { service: 'tesseract', model: 'tesseract' },
      { service: 'openai', model: 'gpt-5.6-sol' }
    ],
    missingProviders: [
      { service: 'tesseract', model: 'tesseract' }
    ],
    providerStates: [
      {
        service: 'tesseract',
        model: 'tesseract',
        artifactDir: 'providers/tesseract',
        status: 'missing',
        attempts: 0
      },
      {
        service: 'openai',
        model: 'gpt-5.6-sol',
        artifactDir: 'providers/openai-gpt-5.6-sol',
        status: 'succeeded',
        attempts: 1
      }
    ],
    step2: {
      extractionMethod: 'pdf+openai-ocr',
      totalPages: 1,
      ocrPages: 1,
      textPages: 0,
      processingTime: 1,
      dpi: 300,
      languages: 'eng',
      ocrService: 'openai',
      ocrModel: 'gpt-5.6-sol'
    }
  })

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    runDir,
    '--provider',
    'openai=gpt-5.6-sol'
  ], {
    env: { NO_COLOR: '1', OPENAI_API_KEY: '' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  const manifest = await readRunManifest(runDir, 'extract')
  expect(result.exitCode).toBe(0)
  expect(output).toContain('selected providers complete; run manifest still incomplete')
  expect(manifest?.metadata['completionStatus']).toBe('incomplete')
  expect(manifest?.metadata['missingProviders']).toEqual([
    { service: 'tesseract', model: 'tesseract' }
  ])
})

test('resume --price reports a dry-run estimate and leaves manifests unchanged', async () => {
  const root = await makeTempRoot('autoshow-resume-price-')
  const runDir = join(root, 'incomplete-tts')
  await writeIncompleteTtsRun(runDir)
  const manifestPath = join(runDir, 'run.json')
  const before = await Bun.file(manifestPath).text()

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    runDir,
    '--price'
  ], {
    env: { NO_COLOR: '1', OPENAI_API_KEY: '' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('gpt-4o-mini-tts-2025-12-15')
  expect(await Bun.file(manifestPath).text()).toBe(before)
})

test('resume --price logs per-directory estimates and a suite total', async () => {
  const root = await makeTempRoot('autoshow-resume-price-many-')
  const firstRunDir = join(root, 'first-tts')
  const secondRunDir = join(root, 'second-tts')
  await writeIncompleteTtsRun(firstRunDir)
  await writeIncompleteTtsRun(secondRunDir)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    firstRunDir,
    secondRunDir,
    '--price'
  ], {
    env: { NO_COLOR: '1', OPENAI_API_KEY: '' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output.match(/Cost Estimate/g)?.length ?? 0).toBe(2)
  expect(output).toContain('Suite Cost Summary')
  expect(output).toContain('2 resume directories')
})

test('write resume --price estimates selected missing LLM providers without provider execution', async () => {
  const root = await makeTempRoot('autoshow-write-resume-price-')
  const runDir = join(root, 'write-run')
  await writeWriteRun(runDir)
  const manifestPath = join(runDir, 'run.json')
  const before = await Bun.file(manifestPath).text()

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    runDir,
    '--provider',
    'groq=openai/gpt-oss-20b',
    '--price'
  ], {
    env: { NO_COLOR: '1', GROQ_API_KEY: '' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('openai/gpt-oss-20b')
  expect(await Bun.file(manifestPath).text()).toBe(before)
})

test('resume --price fails when resumable source metadata is missing', async () => {
  const root = await makeTempRoot('autoshow-resume-price-missing-source-')
  const runDir = join(root, 'stt-run')
  await mkdir(runDir, { recursive: true })
  await writeSttRunManifest(runDir, {
    completionStatus: 'incomplete',
    requestedProviders: [{ service: 'deepgram', model: 'nova-3', local: false }],
    missingProviders: [{ service: 'deepgram', model: 'nova-3', local: false }]
  })

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    runDir,
    '--price'
  ], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(output).toContain('Batch entry is missing step1.url and cannot be resumed.')
})

test('resume rejects positional outputs after the separator', async () => {
  const root = await makeTempRoot('autoshow-resume-double-dash-')
  const completeRunDir = join(root, 'complete-tts')
  await writeCompleteTtsRun(completeRunDir)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'resume',
    completeRunDir,
    '--',
    join(root, 'after-separator')
  ], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected positional outputs after "--" for "resume"')
})

test('removed cache command is unknown', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'cache', 'rotate'])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unknown command "cache"')
})

test('setup focused model downloads cannot be combined with targeted steps', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--models', 'base', '--step', 'uv'])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--models cannot be combined with --step')
})
