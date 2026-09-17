import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { deepinfraOcr } from './cases'

defineOCRServiceTest({
  ...deepinfraOcr,
  models: ['Qwen/Qwen3.8-27B'],
  expectedService: 'deepinfra',
})
