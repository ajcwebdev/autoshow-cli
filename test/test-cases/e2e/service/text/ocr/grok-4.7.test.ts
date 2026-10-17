import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { grokOcr } from './cases'

defineOCRServiceTest({
  ...grokOcr,
  models: ['grok-4.7'],
  expectedService: 'grok',
  inputMode: 'image-only',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
  assertUsageMetadata: true,
})
