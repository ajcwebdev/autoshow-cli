import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { openaiOcr } from './cases'

defineOCRServiceTest({
  ...openaiOcr,
  models: ['gpt-6.1-sol'],
  expectedService: 'openai',
  inputMode: 'image-only',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
  assertUsageMetadata: true,
})
