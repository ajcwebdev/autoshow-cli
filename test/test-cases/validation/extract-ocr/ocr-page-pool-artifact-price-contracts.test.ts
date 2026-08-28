import { describe,expect,test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPipelineItemFromRecord,derivePipelineItemRecord,PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { getOcrPoolAttemptRelativeDir } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch'
import { defaultOcrPoolLaneKey,runOcrPagePool } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { priceOcrTarget } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { OcrPoolLedger,OcrTarget,ResumeTarget } from '~/types'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { withTempDir } from '../../../test-utils/temp-dirs'

const pageResult = (pageNumber: number, target: OcrTarget) => ({
  result: {
    pageNumber,
    method: 'ocr' as const,
    text: `${target.service}/${target.model}: page ${pageNumber}`
  },
  effectiveReasoningEffort: 'default'
})

const runPool = async (overrides: Partial<Parameters<typeof runOcrPagePool>[0]> = {}) => {
  const targets: OcrTarget[] = [
    { service: 'openai', model: 'gpt-5.6-sol' },
    { service: 'mistral', model: 'mistral-ocr-4-0' }
  ]
  let clock = 1_000
  return await runOcrPagePool({
    totalPages: 4,
    requestedTargets: targets,
    targetsToRun: targets,
    providerConcurrency: 2,
    localConcurrency: 1,
    getLaneKey: defaultOcrPoolLaneKey,
    getTargetConcurrency: () => 2,
    getAttemptArtifactDir: getOcrPoolAttemptRelativeDir,
    processPage: async ({ pageNumber, target }) => pageResult(pageNumber, target),
    classifyFailure: (error) => ({
      scope: 'page',
      ambiguous: false,
      failure: { message: error instanceof Error ? error.message : String(error) }
    }),
    now: () => clock++,
    createClaimId: (() => {
      let id = 0
      return () => `claim-${++id}`
    })(),
    ...overrides
  })
}

describe('pooled OCR page scheduler contracts', () => {

  test('attempt artifact paths are isolated and path-contained', () => {
    const path = getOcrPoolAttemptRelativeDir(7, { service: 'deepinfra', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' }, 3)
    expect(path).toBe('providers/deepinfra-Qwen-Qwen3-VL-30B-A3B-Instruct/attempts/page-000007/attempt-003')
    expect(path.startsWith('/')).toBe(false)
    expect(path.split('/')).not.toContain('..')
  })

  test('the canonical manifest item retains the composite output and page ledger as the only resume authority', async () => {
    const ledger = await runPool({ totalPages: 1 })
    const root = '/tmp/autoshow-pool-manifest-contract'
    const record = {
      completionStatus: 'full',
      ocrProviderMode: 'pool',
      ocrPool: ledger,
      step2: { extractionMethod: 'ocr-pool', totalPages: 1 },
      requestedProviders: ledger.targets.map(({ service, model }) => ({ service, model })),
      providerStates: ledger.targets.map(({ service, model, attempts }) => ({
        service,
        model,
        artifactDir: `providers/${service}-${model}`,
        status: 'succeeded',
        attempts,
        metadata: {}
      }))
    }
    const item = createPipelineItemFromRecord(root, record, {
      outputDir: root,
      input: 'document.pdf',
      inputFamily: 'document',
      extractRoute: 'document'
    })
    const restored = derivePipelineItemRecord(root, item)

    expect(restored['ocrProviderMode']).toBe('pool')
    expect(restored['ocrPool']).toEqual(ledger)
    expect(restored['step2']).toEqual(record.step2)
    expect((restored['ocrPool'] as OcrPoolLedger).pages[0]?.accepted?.result.text).toContain('page 1')
  })

  test('pooled resume price preserves stored mode, estimates only unfinished pages, and does not mutate the manifest', async () => {
    await withTempDir('autoshow-pool-resume-price-', async (dir) => {
      const target: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
      let checkpoint: OcrPoolLedger | undefined
      await runPool({
        totalPages: 1,
        requestedTargets: [target],
        targetsToRun: [target],
        onCheckpoint: async (ledger) => {
          if (ledger.pages[0]?.status === 'claimed') {
            checkpoint = ledger
            throw new Error('capture interrupted claim')
          }
        }
      }).catch(() => undefined)
      expect(checkpoint).toBeDefined()
      await writeSingleManifestFixture(dir, 'extract', {
        source: { filePath: join(process.cwd(), 'input/examples/document/3-document.pdf') },
        completionStatus: 'incomplete',
        ocrProviderMode: 'pool',
        ocrPool: checkpoint,
        requestedProviders: [target],
        providerStates: [{ ...target, artifactDir: 'providers/openai-gpt-5.6-sol', status: 'running', attempts: 1, metadata: {} }]
      }, { extractRoute: 'document' })
      const resumeTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'single',
        dir,
        manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
      }
      const manifestPath = join(dir, PIPELINE_MANIFEST_FILE)
      const before = await readFile(manifestPath)
      const estimate = await priceOcrTarget(resumeTarget, buildOptsFromFlags({}))
      const after = await readFile(manifestPath)

      expect(estimate.steps).toHaveLength(1)
      expect(estimate.steps[0]).toMatchObject({ provider: 'openai', model: 'gpt-5.6-sol', pageCount: 1, ocrProviderMode: 'pool' })
      expect(after.equals(before)).toBe(true)

      const explicitFanout = buildOptsFromFlags({ 'ocr-provider-mode': 'fanout' }, {}, new Set(['ocr-provider-mode']))
      await expect(priceOcrTarget(resumeTarget, explicitFanout)).rejects.toThrow('Cannot resume a pool OCR run as fanout')
      expect((await readFile(manifestPath)).equals(before)).toBe(true)
    })
  })
})
