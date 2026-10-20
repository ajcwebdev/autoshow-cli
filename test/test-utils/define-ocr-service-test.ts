import { expect } from 'bun:test'
import { fileExists } from './test-helpers'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import { readProviderResultArtifact, readCanonicalRecord } from './manifest-helpers'
import { assertTextContent } from './assert-generated-content'
import {
  defineBudgetedLiveServiceTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'

const extractServiceFromProvider = (provider: string): string => {
  return provider
}

const requireServiceRunPrerequisites = async (
  envVarKey: string | undefined,
  shouldSkipReadiness: (() => Promise<boolean>) | undefined
): Promise<void> => {
  if (envVarKey) {
    await requireConfiguredEnvVar(envVarKey, `${envVarKey} not configured`)
  }

  if (!shouldSkipReadiness) {
    return
  }

  let ready: boolean
  try {
    ready = !await shouldSkipReadiness()
  } catch (error) {
    throw new Error(
      `readiness check threw: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? { cause: error } : undefined
    )
  }

  if (!ready) {
    throw new Error('readiness prerequisite did not pass')
  }
}

const assertOcrArtifacts = async ({
  outputDir,
  expectedExtractionMethod,
  expectedTotalPages,
  service,
  model,
  assertProviderMetadata,
  assertProviderResult,
  assertUsageMetadata,
  expectedText,
}: {
  outputDir: string
  expectedExtractionMethod: string
  expectedTotalPages?: number
  service: string
  model: string
  assertProviderMetadata: boolean
  assertProviderResult: boolean
  assertUsageMetadata: boolean
  expectedText?: readonly RegExp[]
}): Promise<void> => {
  expect(await fileExists(`${outputDir}/manifest.json`)).toBe(true)
  const extraction = await Bun.file(`${outputDir}/extraction.txt`).text()
  assertTextContent(extraction, 'OCR extraction')
  for (const pattern of expectedText ?? []) expect(extraction).toMatch(pattern)

  if (assertProviderResult) {
    expect(await fileExists(`${outputDir}/result.json`)).toBe(true)
    expect(await readProviderResultArtifact(outputDir)).toBeDefined()
  }

  const metadata = await readCanonicalRecord(outputDir) as {
    step2?: {
      extractionMethod?: string
      totalPages?: number
      ocrService?: string
      ocrModel?: string
      promptTokens?: number
      completionTokens?: number
    }
  }
  expect(metadata.step2?.extractionMethod).toBe(expectedExtractionMethod)
  if (expectedTotalPages !== undefined) {
    expect(metadata.step2?.totalPages).toBe(expectedTotalPages)
  }
  if (assertProviderMetadata || assertUsageMetadata) {
    expect(metadata.step2?.ocrService).toBe(service)
    expect(metadata.step2?.ocrModel).toBe(model)
  }
  if (assertUsageMetadata) {
    expect(metadata.step2?.promptTokens).toBeGreaterThan(0)
    expect(metadata.step2?.completionTokens).toBeGreaterThan(0)
  }
}

export const OCR_PDF_INPUT = 'input/examples/document/1-document.pdf'
export const DEFAULT_OCR_IMAGE_INPUT = 'input/examples/document/1-document.jpg'

export type OcrServiceTestCase = Readonly<{
  ingress: 'pdf' | 'image'
  service: string
  model: string
  budgetKey: string
  name: string
  args: readonly string[]
}>

/**
 * The exact invocations a defineOCRServiceTest config registers. Each ingress is its own test,
 * so each gets its own budget key and price command: `extract-<service>-<model>` for the PDF
 * and `extract-<service>-<model>-image` for the image.
 */
export const ocrServiceTestCases = ({
  models,
  provider,
  expectedService,
  inputMode = 'pdf-and-image',
  imageInput = DEFAULT_OCR_IMAGE_INPUT,
}: {
  models: readonly string[]
  provider: string
  expectedService?: string | undefined
  inputMode?: 'pdf-and-image' | 'image-only' | undefined
  imageInput?: string | undefined
}): OcrServiceTestCase[] => models.flatMap((model) => {
  const service = expectedService ?? extractServiceFromProvider(provider)
  const providerArg = `${provider}=${model}`
  const pdfKey = `extract-${service}-${model}`
  return [
    ...(inputMode === 'pdf-and-image'
      ? [{ ingress: 'pdf' as const, service, model, budgetKey: pdfKey, name: `extract PDF with --provider ${providerArg}`, args: ['src/cli/create-cli.ts', 'extract', OCR_PDF_INPUT, '--provider', providerArg] }]
      : []),
    { ingress: 'image' as const, service, model, budgetKey: `${pdfKey}-image`, name: `extract image with --provider ${providerArg}`, args: ['src/cli/create-cli.ts', 'extract', imageInput, '--provider', providerArg] }
  ]
})

export const defineOCRServiceTest = ({
  models,
  provider,
  expectedService,
  extractionMethod,
  imageExtractionMethod,
  envVarKey,
  inputMode = 'pdf-and-image',
  imageInput = DEFAULT_OCR_IMAGE_INPUT,
  shouldSkipReadiness,
  assertProviderMetadata = false,
  assertProviderResult = false,
  assertUsageMetadata = false,
  timeoutMs = E2E_TEST_TIMEOUT_MS,
}: {
  models: readonly string[]
  provider: string
  expectedService?: string
  extractionMethod: string
  imageExtractionMethod?: string
  envVarKey?: string
  inputMode?: 'pdf-and-image' | 'image-only'
  imageInput?: string
  shouldSkipReadiness?: () => Promise<boolean>
  assertProviderMetadata?: boolean
  assertProviderResult?: boolean
  assertUsageMetadata?: boolean
  timeoutMs?: number
}): void => {
  // Only the bundled document fixtures carry the source page text worth asserting;
  // a hosted or provider-specific image input is checked for artifacts alone.
  const usesDocumentPageFixture = imageInput.startsWith('input/examples/document/1-document.')
  const documentText = [/Amazon\s+Textract/i, /Processing\s+Documents\s+Synchronously/i]

  withOutputLifecycle('1-document')

  for (const testCase of ocrServiceTestCases({ models, provider, expectedService, inputMode, imageInput })) {
    const { ingress, service, model } = testCase
    defineBudgetedLiveServiceTest(testCase.budgetKey, testCase.name, [envVarKey], async () => {
      await requireServiceRunPrerequisites(envVarKey, shouldSkipReadiness)

      const outputDir = await runCommandAndExpectOutputDir('1-document', [...testCase.args])

      await assertOcrArtifacts({
        outputDir,
        expectedExtractionMethod: ingress === 'pdf' ? extractionMethod : imageExtractionMethod ?? extractionMethod,
        ...(ingress === 'pdf' || usesDocumentPageFixture ? { expectedText: documentText } : {}),
        ...(ingress === 'image' ? { expectedTotalPages: 1 } : {}),
        service,
        model,
        assertProviderMetadata,
        assertProviderResult,
        assertUsageMetadata,
      })
    }, timeoutMs)
  }
}
