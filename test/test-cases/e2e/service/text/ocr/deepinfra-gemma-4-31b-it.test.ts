import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { deepinfraOcr } from './cases'

defineOCRServiceTest({
  ...deepinfraOcr,
  models: ['google/gemma-4-31B-it'],
  expectedService: 'deepinfra',
})

