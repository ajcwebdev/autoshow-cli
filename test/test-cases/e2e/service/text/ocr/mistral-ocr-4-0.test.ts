import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { mistralOcr } from './cases'

defineOCRServiceTest({
  ...mistralOcr,
  models: ['mistral-ocr-4-0'],
  expectedService: 'mistral',
})

