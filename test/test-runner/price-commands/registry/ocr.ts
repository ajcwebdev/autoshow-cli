import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const OCR_TEST_DIR = 'test/test-cases/e2e/service/text/ocr'
const PDF_INPUT = 'input/examples/document/1-document.pdf'
const IMAGE_INPUT = 'input/examples/document/1-document.jpg'

type OcrIngress = Readonly<{ pdf: boolean, image: string }>

const PDF_AND_IMAGE: OcrIngress = { pdf: true, image: IMAGE_INPUT }
const IMAGE_ONLY: OcrIngress = { pdf: false, image: IMAGE_INPUT }

// One price command per registered test case, matching defineOCRServiceTest: the PDF case under
// `extract-<provider>-<model>` and the image case under `extract-<provider>-<model>-image`.
const ocrCases = (testFile: string, name: string, provider: string, model: string, ingress: OcrIngress): PriceSelectionEntry[] => {
  const key = `extract-${provider}-${model}`
  const providerArg = `${provider}=${model}`
  return exact(`${OCR_TEST_DIR}/${testFile}`, [
    ...(ingress.pdf ? [command(name, key, ['src/cli/create-cli.ts', 'extract', PDF_INPUT, '--provider', providerArg, '--price'])] : []),
    command(`${name}-image`, `${key}-image`, ['src/cli/create-cli.ts', 'extract', ingress.image, '--provider', providerArg, '--price']),
  ])
}

export const ocrRegistry: PriceSelectionEntry[] = [
  ...ocrCases('openai-gpt-6.1-sol.test.ts', 'extract-openai-gpt-6.1-sol', 'openai', 'gpt-6.1-sol', IMAGE_ONLY),
  ...ocrCases('openai-gpt-6-luna.test.ts', 'extract-openai-gpt-6-luna', 'openai', 'gpt-6-luna', IMAGE_ONLY),
  ...ocrCases('anthropic-claude-opus-5-5.test.ts', 'extract-anthropic-claude-opus-5-5', 'anthropic', 'claude-opus-5-5', IMAGE_ONLY),
  ...ocrCases('anthropic-claude-sonnet-5-5.test.ts', 'extract-anthropic-claude-sonnet-5-5', 'anthropic', 'claude-sonnet-5-5', IMAGE_ONLY),
  ...ocrCases('anthropic-claude-haiku-5-5.test.ts', 'extract-anthropic-claude-haiku-5-5', 'anthropic', 'claude-haiku-5-5', IMAGE_ONLY),
  ...ocrCases('grok-4.7.test.ts', 'extract-grok-grok-4.7', 'grok', 'grok-4.7', IMAGE_ONLY),
  ...ocrCases('gemini-3.8-flash.test.ts', 'extract-gemini-gemini-3.8-flash', 'gemini', 'gemini-3.8-flash', PDF_AND_IMAGE),
  ...ocrCases('mistral-ocr-4-1.test.ts', 'extract-mistral-mistral-ocr-4-1', 'mistral', 'mistral-ocr-4-1', PDF_AND_IMAGE),
]
