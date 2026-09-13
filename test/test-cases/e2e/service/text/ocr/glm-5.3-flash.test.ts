import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { glmOcr } from './cases'

defineOCRServiceTest({
  ...glmOcr,
  models: ['glm-5.3-flash'],
  expectedService: 'glm',
})

