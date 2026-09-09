import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { mistralOcr } from './cases'

defineOCRServiceTest({
  ...mistralOcr,
  models: ['mistral-ocr-4-1'],
  expectedService: 'mistral',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
})
