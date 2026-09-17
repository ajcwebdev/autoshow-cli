import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { deepinfraOcr } from './cases'

defineOCRServiceTest({
  ...deepinfraOcr,
  models: ['deepseek-ai/DeepSeek-V4.1-Flash'],
  expectedService: 'deepinfra',
})
