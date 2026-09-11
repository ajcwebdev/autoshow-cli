import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { openaiOcr } from './cases'

defineOCRServiceTest({
  ...openaiOcr,
  models: ['gpt-6-astra'],
  expectedService: 'openai',
  imageInput: 'input/examples/document/1-document.jpg',
  assertProviderMetadata: true,
})
