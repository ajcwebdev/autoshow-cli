import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { geminiOcr } from './cases'

defineOCRServiceTest({
  ...geminiOcr,
  models: ['gemini-4-argon'],
  expectedService: 'gemini',
  inputMode: 'image-only',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
  assertUsageMetadata: true,
})
