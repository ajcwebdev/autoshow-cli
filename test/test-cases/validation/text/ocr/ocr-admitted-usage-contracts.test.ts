import { describe, expect, spyOn, test } from 'bun:test'
import { join } from 'node:path'
import * as v from 'valibot'
import type { DocumentMetadata, HostedOcrRun, OcrBatchRunContext } from '~/types'
import { ExtractionMetadataSchema, ExtractionOptionsSchema } from '~/types'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runOpenAIOcr } from '~/cli/commands/text/ocr/ocr-services/openai-ocr/run-openai-ocr'
import { extractErrorMetadata } from '~/utils/error-handler'
import { HOSTED_OCR_ADAPTERS } from '~/cli/commands/text/ocr/hosted-ocr-adapters'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { stitchHostedOcrChunkRuns } from '~/cli/commands/text/ocr/ocr-utils/pdf-chunk-page-remap'
import { extractCbzFormat } from '~/cli/commands/text/ocr/ocr-format-extractors'
import * as imageOcr from '~/cli/commands/text/ocr/ocr-image/image-ocr'
import { buildCompositeOutput } from '~/cli/commands/text/ocr/ocr-pool-projection'
import { createOcrPreparationCache } from '~/cli/commands/text/ocr/ocr-utils/preparation-cache'
import { createHostedOcrScheduler } from '~/cli/commands/text/ocr/ocr-utils/hosted-ocr-scheduler'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { runPool } from '../../../../test-utils/ocr-page-pool-fixture'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'], tempPrefix: 'autoshow-ocr-admitted-usage-' })
const metadata: DocumentMetadata = { slug: 'synthetic', format: 'png', pageCount: 1, fileSize: 68 }
const validPages = [{ pageNumber: 1, text: 'first' }, { pageNumber: 2, text: 'second' }]
const providers = [
  {
    provider: 'anthropic', model: 'claude-haiku-5-5', inputTokens: 60000,
    expectedTokens: 120000, expectedCostCents: 1.202,
    run: (path: string) => runAnthropicOcr(path, metadata, 'claude-haiku-5-5'),
    valid: JSON.stringify({ pages: validPages.slice(0, 1) }),
    response: (raw: string, usage?: { input_tokens?: number, output_tokens?: number }) => ({ content: [{ type: 'text', text: raw }], ...(usage ? { usage } : {}) })
  },
  {
    provider: 'openai', model: 'gpt-6.1-sol', inputTokens: 200000,
    expectedTokens: 400000, expectedCostCents: 80.04,
    run: (path: string) => runOpenAIOcr(path, { ...metadata, format: 'pdf', pageCount: 2 }, 'gpt-6.1-sol'),
    valid: JSON.stringify({ pages: validPages }),
    response: (raw: string, usage?: { input_tokens?: number, output_tokens?: number }) => ({ status: 'completed', output_text: raw, ...(usage ? { usage } : {}) })
  }
] as const

const extractionFromRun = (run: HostedOcrRun) => v.parse(ExtractionMetadataSchema, {
  ...run, totalPages: run.totalPages ?? run.pages.length,
  ocrPages: run.pages.length, textPages: 0,
  processingTime: 1, dpi: 300, languages: 'eng', tokenEstimate: 0,
  ocrProviderUsage: run.providerUsage
})

describe('admitted OCR response usage and request-specific registry costs', () => {
  test('Anthropic PDF chunk wrappers preserve both response receipts and summed per-request costs', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'mock-key'
    let admittedMessages = 0
    const calls = installMockFetch(call => {
      if (call.method === 'DELETE') return Response.json({ id: 'file_pdf', type: 'file_deleted' })
      if (call.url.endsWith('/files')) return Response.json({ id: 'file_pdf' })
      admittedMessages++
      return Response.json({
        content: [{ type: 'text', text: admittedMessages === 1 ? 'not json' : '{"pages":[{"pageNumber":1,"text":"first"}]}' }],
        usage: { input_tokens: 60000, output_tokens: admittedMessages === 1 ? 10 : 30 }
      })
    })
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'input.pdf')
      await Bun.write(path, '%PDF-1.4 synthetic transport fixture')
      const result = await runAnthropicOcr(path, { ...metadata, format: 'pdf' }, 'claude-haiku-5-5')
      expect(result).toMatchObject({ promptTokens: 120000, completionTokens: 40, providerCostSource: 'registry_fallback' })
      expect(result.providerCostCents).toBeCloseTo(1.202, 8)
      expect(result.providerUsage).toMatchObject([
        { usageRole: 'schema-retry', promptTokens: 60000, completionTokens: 10 },
        { usageRole: 'success', promptTokens: 60000, completionTokens: 30 }
      ])
      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'first' }])
    })
    expect(admittedMessages).toBe(2)
    expect(calls).toHaveLength(4)
    expect(calls.at(-1)?.method).toBe('DELETE')
  })

  for (const provider of providers) {
    test(`${provider.provider} counts invalid and successful responses without combining their tariff bands`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      process.env['OPENAI_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json(provider.response(calls.length === 1 ? 'not json' : provider.valid, {
        input_tokens: provider.inputTokens, output_tokens: calls.length === 1 ? 10 : 30
      })))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'input')
        await Bun.write(path, '%PDF-1.4 synthetic transport fixture')
        const result = await provider.run(path)
        expect(result.promptTokens).toBe(provider.expectedTokens)
        expect(result.completionTokens).toBe(40)
        expect(result.providerCostSource).toBe('registry_fallback')
        expect(result.providerCostCents).toBeCloseTo(provider.expectedCostCents, 8)
        expect(result.providerUsage).toMatchObject([
          { provider: provider.provider, model: provider.model, attempt: 1, usageRole: 'schema-retry', promptTokens: provider.inputTokens, completionTokens: 10, usageMetadata: { input_tokens: provider.inputTokens, output_tokens: 10 } },
          { provider: provider.provider, model: provider.model, attempt: 2, usageRole: 'success', promptTokens: provider.inputTokens, completionTokens: 30, usageMetadata: { input_tokens: provider.inputTokens, output_tokens: 30 } }
        ])
        expect(result.pages.map(page => page.text)).toEqual(provider.provider === 'anthropic' ? ['first'] : ['first', 'second'])
      })
      expect(calls).toHaveLength(2)
    })

    test(`${provider.provider} preserves all admitted usage when the bounded schema reasks fail`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      process.env['OPENAI_API_KEY'] = 'mock-key'
      const usage = { input_tokens: 7, output_tokens: 5 }
      const calls = installMockFetch(() => Response.json(provider.response('not json', usage)))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'input')
        await Bun.write(path, 'synthetic transport fixture')
        try {
          await provider.run(path)
          expect.unreachable('Invalid artifact must fail')
        } catch (error) {
          expect(extractErrorMetadata(error)).toMatchObject({
            promptTokens: 21, completionTokens: 15,
            rawProviderUsage: usage, admittedResponseUsage: [usage, usage, usage],
            providerCostSource: 'registry_fallback',
            providerUsage: [
              { attempt: 1, usageRole: 'schema-retry', promptTokens: 7, completionTokens: 5 },
              { attempt: 2, usageRole: 'schema-retry', promptTokens: 7, completionTokens: 5 },
              { attempt: 3, usageRole: 'schema-retry', promptTokens: 7, completionTokens: 5 }
            ]
          })
        }
      })
      expect(calls).toHaveLength(3)
    })

    test(`${provider.provider} hosted adapter forwards each-response costs to the actual-cost consumer`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      process.env['OPENAI_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json(provider.response(calls.length === 1 ? 'not json' : provider.valid, {
        input_tokens: provider.inputTokens, output_tokens: calls.length === 1 ? 10 : 30
      })))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'input')
        await Bun.write(path, 'synthetic transport fixture')
        const adapter = HOSTED_OCR_ADAPTERS.find(candidate => candidate.service === provider.provider)
        expect(adapter).toBeDefined()
        const run = await adapter!.request({
          inputPath: path,
          inputMetadata: provider.provider === 'openai' ? { ...metadata, format: 'pdf', pageCount: 2 } : metadata,
          ocrModel: provider.model,
          opts: v.parse(ExtractionOptionsSchema, { filePath: path, outputDir: dir })
        })
        expect(run.providerCostCents).toBeCloseTo(provider.expectedCostCents, 8)
        expect(run.providerUsage).toHaveLength(2)
        const extraction = v.parse(ExtractionMetadataSchema, {
          ...run, totalPages: run.totalPages ?? run.pages.length,
          ocrPages: run.pages.length, textPages: 0,
          processingTime: 1, dpi: 300, languages: 'eng', tokenEstimate: 0,
          ocrProviderUsage: run.providerUsage
        })
        const actual = computeActualCosts({ step2: extraction })
        expect(actual.steps[0]).toMatchObject({
          provider: provider.provider, model: provider.model,
          costSource: 'registry_fallback', promptTokens: provider.expectedTokens, completionTokens: 40
        })
        expect(actual.steps[0]?.cost).toBeCloseTo(provider.expectedCostCents, 8)
      })
      expect(calls).toHaveLength(2)
    })

    test(`${provider.provider} keeps incomplete usage evidence without claiming a complete registry cost`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      process.env['OPENAI_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json(provider.response(calls.length === 1 ? 'not json' : provider.valid, calls.length === 1 ? undefined : { input_tokens: 7, output_tokens: 0 })))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'input')
        await Bun.write(path, 'synthetic transport fixture')
        const result = await provider.run(path)
        expect(result.promptTokens).toBe(7)
        expect(result.completionTokens).toBe(0)
        expect(result.providerCostCents).toBeCloseTo(provider.provider === 'anthropic' ? 0.00007 : 0.0014, 8)
        expect(result.providerCostSource).toBe('partial_provider_usage')
        expect(result.providerUsage).toHaveLength(2)
        expect(result.providerUsage?.[0]).toMatchObject({ attempt: 1, usageRole: 'schema-retry' })
        expect(result.providerUsage?.[0]).not.toHaveProperty('promptTokens')
        expect(result.providerUsage?.[1]).toMatchObject({ promptTokens: 7, completionTokens: 0 })
      })
      expect(calls).toHaveLength(2)
    })

    for (const incomplete of [undefined, { input_tokens: 17 }, { output_tokens: 13 }]) {
      test(`${provider.provider} adapter and actual costs retain a partial per-request subtotal for ${JSON.stringify(incomplete) ?? 'missing usage'}`, async () => {
        process.env['ANTHROPIC_API_KEY'] = 'mock-key'
        process.env['OPENAI_API_KEY'] = 'mock-key'
        const calls = installMockFetch(() => Response.json(provider.response(calls.length < 3 ? 'not json' : provider.valid,
          calls.length === 2 ? incomplete : { input_tokens: provider.inputTokens, output_tokens: calls.length === 1 ? 10 : 30 }
        )))
        await lifecycle.withDir(async dir => {
          const path = join(dir, 'input')
          await Bun.write(path, 'synthetic transport fixture')
          const adapter = HOSTED_OCR_ADAPTERS.find(candidate => candidate.service === provider.provider)!
          const run = await adapter.request({
            inputPath: path,
            inputMetadata: provider.provider === 'openai' ? { ...metadata, format: 'pdf', pageCount: 2 } : metadata,
            ocrModel: provider.model,
            opts: v.parse(ExtractionOptionsSchema, { filePath: path, outputDir: dir })
          })
          expect(run.providerCostCents).toBeCloseTo(provider.expectedCostCents, 8)
          expect(run.providerCostSource).toBe('partial_provider_usage')
          expect(run.providerUsage).toHaveLength(3)
          expect(run.providerUsage?.[1]).toMatchObject({ attempt: 2, usageRole: 'schema-retry' })
          expect(run.providerUsage?.[1]).not.toHaveProperty('providerCostCents')
          if (incomplete) expect(run.providerUsage?.[1]?.['usageMetadata']).toEqual(incomplete)
          const actual = computeActualCosts({ step2: extractionFromRun(run) })
          expect(actual.steps[0]).toMatchObject({
            provider: provider.provider, model: provider.model, costSource: 'partial_provider_usage',
            promptTokens: provider.expectedTokens + (incomplete?.input_tokens ?? 0),
            completionTokens: 40 + (incomplete?.output_tokens ?? 0)
          })
          expect(actual.totalCost).toBeCloseTo(provider.expectedCostCents, 8)
          // The sum crosses the long-context threshold; only individual complete
          // receipts may select a tariff band, even while evidence is partial.
          expect(actual.steps[0]?.cost).toBeCloseTo(provider.expectedCostCents, 8)
        })
        expect(calls).toHaveLength(3)
      })
    }

    test(`${provider.provider} absent usage never becomes a complete zero-cost actual row`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-key'
      process.env['OPENAI_API_KEY'] = 'mock-key'
      const calls = installMockFetch(() => Response.json(provider.response(provider.valid)))
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'input')
        await Bun.write(path, 'synthetic transport fixture')
        const run = await HOSTED_OCR_ADAPTERS.find(candidate => candidate.service === provider.provider)!.request({
          inputPath: path,
          inputMetadata: provider.provider === 'openai' ? { ...metadata, format: 'pdf', pageCount: 2 } : metadata,
          ocrModel: provider.model,
          opts: v.parse(ExtractionOptionsSchema, { filePath: path, outputDir: dir })
        })
        expect(run).toMatchObject({ providerCostCents: 0, providerCostSource: 'partial_provider_usage' })
        expect(run.providerUsage).toHaveLength(1)
        expect(run.providerUsage?.[0]).not.toHaveProperty('promptTokens')
        expect(run.providerUsage?.[0]).not.toHaveProperty('completionTokens')
        expect(computeActualCosts({ step2: extractionFromRun(run) }).steps[0]).toMatchObject({ cost: 0, costSource: 'partial_provider_usage' })
      })
      expect(calls).toHaveLength(1)
    })
  }

  test('PDF chunk stitching retains partial cost evidence when complete chunks follow', () => {
    const runs: HostedOcrRun[] = [
      { pages: [{ pageNumber: 1, method: 'ocr', text: 'first' }], extractionMethod: 'openai-ocr', ocrService: 'openai', ocrModel: 'gpt-6.1-sol', providerCostCents: 0.4, providerCostSource: 'partial_provider_usage' },
      { pages: [{ pageNumber: 2, method: 'ocr', text: 'second' }], extractionMethod: 'openai-ocr', ocrService: 'openai', ocrModel: 'gpt-6.1-sol', providerCostCents: 0.6, providerCostSource: 'registry_fallback' }
    ]
    const stitched = stitchHostedOcrChunkRuns(runs, 2)
    expect(stitched).toMatchObject({ providerCostCents: 1, providerCostSource: 'partial_provider_usage' })
    expect(computeActualCosts({ step2: extractionFromRun(stitched) }).steps[0]).toMatchObject({ cost: 1, costSource: 'partial_provider_usage' })
  })

  test('CBZ extraction retains partial cost evidence when a fully priced page follows', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'mock-key'
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'page.png')
      await Bun.write(path, 'synthetic transport fixture')
      const imageSpy = spyOn(imageOcr, 'extractCbzImages').mockResolvedValue([path, path])
      try {
        const calls = installMockFetch(() => Response.json({
          content: [{ type: 'text', text: '{"pages":[{"pageNumber":1,"text":"Synthetic page"}]}' }],
          ...(calls.length === 1 ? {} : { usage: { input_tokens: 100, output_tokens: 20 } })
        }))
        const result = await extractCbzFormat(join(dir, 'input.cbz'), { ...metadata, format: 'cbz', pageCount: 2 }, v.parse(ExtractionOptionsSchema, {
          filePath: path, outputDir: dir, anthropicOcrModel: 'claude-haiku-5-5'
        }))
        expect(result).toMatchObject({ providerCostCents: 0.002, providerCostSource: 'partial_provider_usage' })
        const extraction = v.parse(ExtractionMetadataSchema, {
          ...result, ocrModel: 'claude-haiku-5-5', totalPages: 2, ocrPages: 2, textPages: 0,
          processingTime: 1, dpi: 300, languages: 'eng', tokenEstimate: 0
        })
        expect(computeActualCosts({ step2: extraction }).steps[0]).toMatchObject({ cost: 0.002, costSource: 'partial_provider_usage' })
        expect(calls).toHaveLength(2)
      } finally {
        imageSpy.mockRestore()
      }
    })
  })

  test('pooled projection and actual costs keep a partial subtotal alongside complete attempts', async () => {
    const target = { service: 'openai', model: 'gpt-6.1-sol' } as const
    const ledger = await runPool({
      totalPages: 2, requestedTargets: [target], targetsToRun: [target],
      processPage: async ({ pageNumber }) => ({
        result: { pageNumber, method: 'ocr', text: `Synthetic page ${pageNumber}` },
        providerCostCents: pageNumber === 1 ? 0.4 : 0.6,
        providerCostSource: pageNumber === 1 ? 'partial_provider_usage' : 'registry_fallback'
      })
    })
    const opts = v.parse(ExtractionOptionsSchema, { filePath: 'synthetic.png', outputDir: '.' })
    const ctx: OcrBatchRunContext = {
      outputDir: '.', requestedTargets: [target], targetsToRun: [target], opts: { ...opts, ocrConcurrencyMode: 'fixed' }, effectiveOpts: opts,
      ocrPreparationCache: createOcrPreparationCache(), hostedOcrScheduler: createHostedOcrScheduler({ mode: 'fixed', pageCount: 2, fixedCap: 1 }),
      step1Metadata: { ...metadata, pageCount: 2 }, documentSource: { filePath: 'synthetic.png' }, extractFilePath: 'synthetic.png'
    }
    const composite = buildCompositeOutput(ctx, ledger, 0)
    expect(composite.metadata).toMatchObject({ providerCostCents: 1, providerCostSource: 'partial_provider_usage', ocrPoolTargetUsage: [{ providerCostCents: 1, providerCostSource: 'partial_provider_usage' }] })
    expect(computeActualCosts({ step2: composite.metadata }).steps[0]).toMatchObject({ cost: 1, costSource: 'partial_provider_usage' })
  })
})

