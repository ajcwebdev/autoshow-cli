import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const OCR_TEST_DIR = 'test/test-cases/e2e/service/text/ocr'
const PDF_INPUT = 'input/examples/document/1-document.pdf'
const IMAGE_INPUT = 'input/examples/document/1-document.jpg'
const HOSTED_IMAGE_INPUT = 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png'

type OcrIngress = Readonly<{ pdf: boolean, image: string }>

const PDF_AND_IMAGE: OcrIngress = { pdf: true, image: IMAGE_INPUT }
const IMAGE_ONLY: OcrIngress = { pdf: false, image: IMAGE_INPUT }
const HOSTED_IMAGE_ONLY: OcrIngress = { pdf: false, image: HOSTED_IMAGE_INPUT }

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
  ...ocrCases('gemini-4-argon.test.ts', 'extract-gemini-gemini-4-argon', 'gemini', 'gemini-4-argon', IMAGE_ONLY),
  ...ocrCases('grok-4.7.test.ts', 'extract-grok-grok-4.7', 'grok', 'grok-4.7', IMAGE_ONLY),
  ...ocrCases('mistral-ocr-4-0.test.ts', 'extract-mistral-mistral-ocr-4-0', 'mistral', 'mistral-ocr-4-0', PDF_AND_IMAGE),
  ...ocrCases('glm-5.3-flash.test.ts', 'extract-glm-glm-5.3-flash', 'glm', 'glm-5.3-flash', PDF_AND_IMAGE),
  ...ocrCases('kimi-k2.6.test.ts', 'extract-kimi-kimi-k2.6', 'kimi', 'kimi-k2.6', PDF_AND_IMAGE),
  ...ocrCases('gemini-3.5-flash-lite.test.ts', 'extract-gemini-gemini-3.5-flash-lite', 'gemini', 'gemini-3.5-flash-lite', PDF_AND_IMAGE),
  ...ocrCases('deepinfra-gemma-4-31b-it.test.ts', 'extract-deepinfra-google-gemma-4-31b-it', 'deepinfra', 'google/gemma-4-31B-it', PDF_AND_IMAGE),
  ...ocrCases('deepinfra-qwen3.8-27b.test.ts', 'extract-deepinfra-qwen-qwen3.8-27b', 'deepinfra', 'Qwen/Qwen3.8-27B', PDF_AND_IMAGE),
  ...ocrCases('deepinfra-deepseek-v4.1-flash.test.ts', 'extract-deepinfra-deepseek-ai-deepseek-v4.1-flash', 'deepinfra', 'deepseek-ai/DeepSeek-V4.1-Flash', PDF_AND_IMAGE),
  ...ocrCases('grok-4.6.test.ts', 'extract-grok-grok-4.6', 'grok', 'grok-4.6', HOSTED_IMAGE_ONLY),
  ...ocrCases('gemini-3.7-flash.test.ts', 'extract-gemini-gemini-3.7-flash', 'gemini', 'gemini-3.7-flash', PDF_AND_IMAGE),
  ...ocrCases('gemini-3.8-flash.test.ts', 'extract-gemini-gemini-3.8-flash', 'gemini', 'gemini-3.8-flash', PDF_AND_IMAGE),
  ...ocrCases('anthropic-claude-fable-5-1.test.ts', 'extract-anthropic-claude-fable-5-1', 'anthropic', 'claude-fable-5-1', PDF_AND_IMAGE),
  ...ocrCases('openai-gpt-6-astra.test.ts', 'extract-openai-gpt-6-astra', 'openai', 'gpt-6-astra', PDF_AND_IMAGE),
  ...ocrCases('mistral-ocr-4-1.test.ts', 'extract-mistral-mistral-ocr-4-1', 'mistral', 'mistral-ocr-4-1', PDF_AND_IMAGE),
  ...ocrCases('anthropic-claude-sonnet-5.test.ts', 'extract-anthropic-claude-sonnet-5', 'anthropic', 'claude-sonnet-5', HOSTED_IMAGE_ONLY),
]
