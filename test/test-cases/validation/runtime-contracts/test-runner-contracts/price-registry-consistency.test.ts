import { describe, expect, test } from 'bun:test'
import type { PriceSelectionEntry } from '~/types'
import { BUDGET_PRICE_SELECTION_REGISTRY } from '../../../../test-runner/price-commands/registry/index'
import { auditPriceRegistryConsistency } from './budget-coverage-audit'
import { inspectBudgetSource } from './budget-source-inspection'
import { loadE2eTestSources } from './e2e-test-sources'

const OCR_FILE = 'test/test-cases/e2e/service/text/ocr/fixture.test.ts'
const STT_FILE = 'test/test-cases/e2e/service/stt/fixture.test.ts'

const priced = (file: string, key: string, args: string[], budgetSkippable = true): PriceSelectionEntry => ({
  name: key, key, args: [...args, '--price'], budgetSkippable, selector: file, selectorKind: 'file'
})

const ocrPdf = (model: string): string[] => ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', `openai=${model}`]
const ocrImage = (model: string, input = 'input/examples/document/1-document.jpg'): string[] => ['src/cli/create-cli.ts', 'extract', input, '--provider', `openai=${model}`]

const audit = (sources: Record<string, string>, registry: PriceSelectionEntry[], modules: Record<string, string> = {}) =>
  auditPriceRegistryConsistency(
    Object.entries(sources).map(([file, source]) => ({ file, source })),
    registry,
    (file, source) => inspectBudgetSource(file, source, (path) => modules[path])
  )

describe('price registry consistency with registered test cases', () => {
  test('every e2e test case is priced with its exact invocation, and no budget price command is orphaned', async () => {
    expect(auditPriceRegistryConsistency(await loadE2eTestSources(), BUDGET_PRICE_SELECTION_REGISTRY, inspectBudgetSource)).toEqual({
      orphaned: [],
      unpriced: [],
      mismatched: []
    })
  })

  test('an OCR config prices its PDF and image cases separately', () => {
    const source = `defineOCRServiceTest({ provider: 'openai', models: ['gpt-a'] })`
    expect(audit({ [OCR_FILE]: source }, [
      priced(OCR_FILE, 'extract-openai-gpt-a', ocrPdf('gpt-a')),
      priced(OCR_FILE, 'extract-openai-gpt-a-image', ocrImage('gpt-a')),
    ])).toEqual({ orphaned: [], unpriced: [], mismatched: [] })

    expect(audit({ [OCR_FILE]: source }, [priced(OCR_FILE, 'extract-openai-gpt-a', ocrPdf('gpt-a'))]).unpriced)
      .toEqual([`${OCR_FILE}: extract-openai-gpt-a-image`])
  })

  test('a model added to a test without a price command is unpriced, and the replaced model is orphaned', () => {
    const source = `defineOCRServiceTest({ provider: 'openai', models: ['gpt-new'], inputMode: 'image-only' })`
    expect(audit({ [OCR_FILE]: source }, [priced(OCR_FILE, 'extract-openai-gpt-old-image', ocrImage('gpt-old'))])).toEqual({
      orphaned: [`${OCR_FILE}: extract-openai-gpt-old-image`],
      unpriced: [`${OCR_FILE}: extract-openai-gpt-new-image`],
      mismatched: []
    })
  })

  test('a second model priced under a test that never selects it is orphaned', () => {
    const source = `defineOCRServiceTest({ provider: 'openai', models: ['gpt-lite'], inputMode: 'image-only' })`
    expect(audit({ [OCR_FILE]: source }, [
      priced(OCR_FILE, 'extract-openai-gpt-lite-image', ocrImage('gpt-lite')),
      priced(OCR_FILE, 'extract-openai-gpt-full-image', ocrImage('gpt-full')),
    ]).orphaned).toEqual([`${OCR_FILE}: extract-openai-gpt-full-image`])
  })

  test('a report-only estimate without a test key is not an orphan', () => {
    expect(audit({ [OCR_FILE]: `test('local', () => {})` }, [priced(OCR_FILE, 'extract-local-estimate', ocrPdf('local'), false)]))
      .toEqual({ orphaned: [], unpriced: [], mismatched: [] })
  })

  test('an overridden input that the price command ignores is mismatched', () => {
    const source = `defineOCRServiceTest({ provider: 'openai', models: ['gpt-a'], inputMode: 'image-only', imageInput: 'input/examples/document/1-document.png' })`
    expect(audit({ [OCR_FILE]: source }, [priced(OCR_FILE, 'extract-openai-gpt-a-image', ocrImage('gpt-a'))]).mismatched).toEqual([
      `${OCR_FILE}: extract-openai-gpt-a-image prices "src/cli/create-cli.ts extract input/examples/document/1-document.jpg --provider openai=gpt-a" but the test runs "src/cli/create-cli.ts extract input/examples/document/1-document.png --provider openai=gpt-a"`
    ])
  })

  test('configuration spread from a sibling cases module is resolved, including later overrides', () => {
    const casesPath = 'test/test-cases/e2e/service/text/ocr/cases.ts'
    const modules: Record<string, string> = {
      [casesPath]: `export const hostedImage = 'https://example.test/page.png'
export const openaiOcr = { provider: 'openai', inputMode: 'image-only', imageInput: hostedImage } as const`
    }
    const source = `import { openaiOcr } from './cases'
defineOCRServiceTest({ ...openaiOcr, models: ['gpt-a'], imageInput: 'input/examples/document/1-document.jpg' })`
    const inspection = inspectBudgetSource(OCR_FILE, source, (path) => modules[path])

    expect(inspection.issues).toEqual([])
    expect(inspection.invocations).toEqual([{ key: 'extract-openai-gpt-a-image', args: ocrImage('gpt-a') }])
  })

  test('an unresolvable spread is reported instead of guessing the invocation', () => {
    const inspection = inspectBudgetSource(OCR_FILE, `import { missing } from './absent'
defineOCRServiceTest({ ...missing, provider: 'openai', models: ['gpt-a'] })`, () => undefined)

    expect(inspection.invocations).toEqual([])
    expect(inspection.issues).toEqual([`${OCR_FILE}: defineOCRServiceTest spreads a value that is not an inspectable object literal`])
  })

  test('STT tests accept the local copy of the hosted example audio but flag any other input', () => {
    const hosted = `defineSTTServiceTest({ provider: 'gladia', sttService: 'gladia', models: ['solaria-3'] })`
    const short = `defineSTTServiceTest({ provider: 'gladia', sttService: 'gladia', models: ['solaria-3'], inputPath: 'input/examples/audio/0-audio-short.mp3' })`
    const priceLocalExample = priced(STT_FILE, 'transcribe-gladia-solaria-3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'gladia=solaria-3'])

    expect(audit({ [STT_FILE]: hosted }, [priceLocalExample]).mismatched).toEqual([])
    expect(audit({ [STT_FILE]: short }, [priceLocalExample]).mismatched).toEqual([
      `${STT_FILE}: transcribe-gladia-solaria-3 prices "src/cli/create-cli.ts extract input/examples/audio/1-audio.mp3 --provider gladia=solaria-3" but the test runs "src/cli/create-cli.ts extract input/examples/audio/0-audio-short.mp3 --provider gladia=solaria-3"`
    ])
  })
})
