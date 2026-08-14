import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { replicateOcr } from './cases'

defineOCRServiceTest({
  ...replicateOcr,
  models: ['datalab-to/ocr', 'datalab-to/marker', 'lucataco/deepseek-ocr'],
  expectedService: 'replicate',
})
