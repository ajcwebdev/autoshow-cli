import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { anthropicOcr } from './cases'

defineOCRServiceTest({
  ...anthropicOcr,
  models: ['claude-fable-5-1'],
  expectedService: 'anthropic',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
})
