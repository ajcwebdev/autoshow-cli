import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { falOcr } from './cases'

defineOCRServiceTest({
  ...falOcr,
  models: ['fal-ai/got-ocr/v2'],
  expectedService: 'fal',
})
