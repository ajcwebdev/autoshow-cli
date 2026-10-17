import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { anthropicOcr } from './cases'

defineOCRServiceTest({
  ...anthropicOcr,
  models: ['claude-haiku-5-5'],
  expectedService: 'anthropic',
  inputMode: 'image-only',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
  assertUsageMetadata: true,
})
