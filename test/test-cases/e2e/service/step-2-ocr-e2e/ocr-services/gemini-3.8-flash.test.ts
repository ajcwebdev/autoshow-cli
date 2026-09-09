import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { geminiOcr } from './cases'

defineOCRServiceTest({
  ...geminiOcr,
  models: ['gemini-3.8-flash'],
  expectedService: 'gemini',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
})
