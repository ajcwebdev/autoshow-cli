import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { resolveExtractionProviderModel } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import type { ExtractionMetadata } from '~/types'

describe('price mode contracts', () => {

  test('URL article extraction methods resolve provider models consistently', () => {
      const base: Omit<ExtractionMetadata, 'extractionMethod'> = {
        totalPages: 1,
        ocrPages: 0,
        textPages: 1,
        processingTime: 1234,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 100
      }

      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+defuddle' })).toEqual({
        provider: 'defuddle',
        model: 'defuddle'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+glm-reader' })).toEqual({
        provider: 'glm-reader',
        model: 'glm-reader'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+spider' })).toEqual({
        provider: 'spider',
        model: 'spider'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+supadata' })).toEqual({
        provider: 'supadata',
        model: 'supadata'
      })
      expect(resolveExtractionProviderModel({ ...base, extractionMethod: 'html+zyte' })).toEqual({
        provider: 'zyte',
        model: 'zyte'
      })
      expect(computeActualCosts({ step2: { ...base, extractionMethod: 'html+defuddle' } }).steps[0]).toMatchObject({
        step: 'extract',
        provider: 'defuddle',
        model: 'defuddle',
        cost: 0
      })
      expect(computeActualCosts({ step2: { ...base, extractionMethod: 'html+spider' } }).steps[0]).toMatchObject({
        step: 'extract',
        provider: 'spider',
        model: 'spider',
        cost: 0.12
      })
      expect(computeActualProcessingTimes({ step2: { ...base, extractionMethod: 'html+zyte' } }).steps[0]).toMatchObject({
        provider: 'zyte',
        model: 'zyte',
        processingTimeMs: 1234
      })
    })
})
