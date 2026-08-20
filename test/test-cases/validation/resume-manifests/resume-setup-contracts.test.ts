import { afterEach, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseNativeCli } from '~/cli/native/native-parser'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { renderCommandHelp } from '~/cli/native/help-renderer'
import { runCommand } from '../../../test-utils/test-helpers'
import { PIPELINE_MANIFEST_FILE, readSinglePipelineItemRecord, writePipelineItemRecords } from '~/cli/commands/process-steps/pipeline-manifest'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import type { PipelineProviderState, Step3Metadata, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const tempDirs: string[] = []

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await makeTempDir(prefix)
  tempDirs.push(root)
  return root
}

const policySkippedTtsState = (target: TtsTarget, artifactRoot = 'providers'): PipelineProviderState => {
  const targetKey = target.targetKey as string
  const actor = { namespace: 'local-user' as const, actorId: 'fixture' }
  const at = new Date(0).toISOString()
  const evidence = {
    schemaVersion: 1 as const,
    skipId: `skip-${targetKey}`,
    targetKey,
    reasonCode: 'user-requested' as const,
    reason: 'fixture skip',
    actor,
    at
  }
  const projection = {
    activeWork: { kind: 'policy-skip' as const, evidence },
    branchHistory: [],
    readinessAttempts: [],
    renderHistory: [],
    pointerEvents: [{ sequence: 1, action: 'activate-policy-skip' as const, skipId: evidence.skipId, actor, at }]
  }
  return {
    service: target.service,
    model: target.model,
    local: false,
    operation: 'tts-synthesis',
    targetKey,
    transport: target.transport as string,
    artifactDir: `${artifactRoot}/${targetKey}`,
    status: 'skipped',
    attempts: 0,
    options: {},
    metadata: { ttsAudio: projection },
    result: { ttsAudio: projection }
  }
}

const writeCompleteTtsRun = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true })
  const sourcePath = join(dir, 'source.txt')
  await Bun.write(sourcePath, 'Hello.')
  const target: TtsTarget = {
    service: 'openai',
    model: 'gpt-4o-mini-tts-2025-12-15',
    operation: 'tts-synthesis',
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('tts-synthesis', 'openai', 'gpt-4o-mini-tts-2025-12-15', 'hosted-api'),
    run: async () => { throw new Error('not called in completed resume fixture') }
  }
  await writeSingleManifestFixture(dir, 'tts', {
    input: sourcePath,
    completionStatus: 'skipped',
    requestedProviders: [{
      service: target.service,
      model: target.model,
      operation: target.operation,
      targetKey: target.targetKey,
      transport: target.transport
    }],
    providerStates: [policySkippedTtsState(target)],
    tts: []
  })
}

const writeIncompleteTtsRun = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true })
  const input = 'Hello from resume price mode.'
  const sourcePath = join(dir, 'source.txt')
  await Bun.write(sourcePath, input)
  const sourceIdentity = await createFileTtsSourceIdentity(sourcePath, input)
  if (sourceIdentity.sourceLocator.kind !== 'file') throw new Error('Expected a file-backed resume price source identity.')
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, input)
  const openaiTarget: TtsTarget = {
    service: 'openai',
    model: 'gpt-4o-mini-tts-2025-12-15',
    operation: 'tts-synthesis',
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('tts-synthesis', 'openai', 'gpt-4o-mini-tts-2025-12-15', 'hosted-api'),
    voice: 'alloy',
    run: async () => { throw new Error('fixture failure before provider dispatch') }
  }
  let failedState: PipelineProviderState | undefined
  await runTtsForTargets(input, dir, {}, [openaiTarget], {
    sourceIdentity,
    dialoguePlan,
    onProviderState: async (state) => { failedState = state }
  }).catch(() => undefined)
  if (!failedState || failedState.status !== 'failed') throw new Error('Failed to materialize canonical resume price fixture state.')
  failedState = bindTtsDialoguePlanArtifact(
    failedState,
    await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
  )
  const groqTarget: TtsTarget = {
    service: 'groq',
    model: 'canopylabs/orpheus-v1-english',
    operation: 'tts-synthesis',
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('tts-synthesis', 'groq', 'canopylabs/orpheus-v1-english', 'hosted-api'),
    run: async () => { throw new Error('not called in resume price fixture') }
  }
  await writeSingleManifestFixture(dir, 'tts', {
    input: sourceIdentity.sourceLocator.canonicalPath,
    completionStatus: 'failed',
    requestedProviders: [
      {
        service: groqTarget.service,
        model: groqTarget.model,
        operation: groqTarget.operation,
        targetKey: groqTarget.targetKey,
        transport: groqTarget.transport
      },
      {
        service: openaiTarget.service,
        model: openaiTarget.model,
        operation: openaiTarget.operation,
        targetKey: openaiTarget.targetKey,
        transport: openaiTarget.transport
      }
    ],
    providerStates: [policySkippedTtsState(groqTarget), failedState],
    tts: []
  })
}

const writeWriteRun = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true })
  await writeSingleManifestFixture(dir, 'write', {
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

test('resume surface is reachable through help', () => {
  const resume = COMMAND_DEFINITIONS.find((command) => command.name === 'resume')
  if (!resume) throw new Error('missing resume command')
  const stdout = renderCommandHelp(createNativeRootDefinition(), resume)

  expect(stdout).toContain('bun autoshow resume')
  expect(stdout).toContain('<outputDirs...>')
  expect(stdout).toContain('--provider')
  expect(stdout).toContain('--tts-voice')
  expect(stdout).not.toContain('--refresh-cache')
  expect(stdout).not.toContain('--no-cache')
})

test('resume requires an explicit output directory', () => {
  expect(() => parseNativeCli(['resume'], COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS))
    .toThrow('Missing required parameter: outputDirs')
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

test('resume loudly rejects a corrupt canonical manifest', async () => {
  const runDir = await makeTempRoot('autoshow-corrupt-resume-manifest-')
  const manifestPath = join(runDir, PIPELINE_MANIFEST_FILE)
  await Bun.write(manifestPath, JSON.stringify({
    command: 'extract',
    scope: 'single',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [{ extractRoute: 'media', status: 'incomplete', metadata: {} }]
  }))

  const result = await runCommand(['src/cli/create-cli.ts', 'resume', runDir], {
    env: { NO_COLOR: '1' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(output).toContain(`Invalid canonical manifest at ${manifestPath}`)
  expect(output).toContain('Re-run the pipeline to regenerate this output.')
})

test('resume reports that X-Space extract runs are not resumable', async () => {
  const runDir = await makeTempRoot('autoshow-x-space-resume-')
  await writeSingleManifestFixture(runDir, 'extract', {
    source: { url: 'https://x.com/i/spaces/1DXxyRYNejbKM' }
  }, { extractRoute: 'x-space' })

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
  await writePipelineItemRecords(batchDir, 'extract', 'batch', [{
      input: 'https://x.com/i/spaces/1DXxyRYNejbKM',
      inputFamily: 'x_space',
      extractRoute: 'x-space',
      completionStatus: 'full',
      outputDir: 'x-space-output'
  }], { extractRoute: 'x-space', source: { childBatches: { 'x-space': 'x-space' } } })

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
  await writeSingleManifestFixture(runDir, 'extract', {
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
  }, { extractRoute: 'document' })

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
  const manifest = await readSinglePipelineItemRecord(runDir, { command: 'extract', extractRoute: 'document' })
  expect(result.exitCode).toBe(0)
  expect(output).toContain('selected providers complete; canonical item still incomplete')
  expect(manifest?.['completionStatus']).toBe('incomplete')
  expect(manifest?.['missingProviders']).toEqual([
    { service: 'tesseract', model: 'tesseract' }
  ])
})

test('resume --price reports a dry-run estimate and leaves manifests unchanged', async () => {
  const root = await makeTempRoot('autoshow-resume-price-')
  const runDir = join(root, 'incomplete-tts')
  await writeIncompleteTtsRun(runDir)
  const manifestPath = join(runDir, PIPELINE_MANIFEST_FILE)
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
  const manifestPath = join(runDir, PIPELINE_MANIFEST_FILE)
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
  await writeSingleManifestFixture(runDir, 'extract', {
    completionStatus: 'incomplete',
    requestedProviders: [{ service: 'deepgram', model: 'nova-3', local: false }],
    missingProviders: [{ service: 'deepgram', model: 'nova-3', local: false }]
  }, { extractRoute: 'media' })

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
  expect(output).toContain('Pipeline item record is missing step1.url and cannot be resumed.')
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

test('setup focused model downloads cannot be combined with targeted steps', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--models', 'base', '--step', 'defuddle'])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('--models cannot be combined with --step')
})
