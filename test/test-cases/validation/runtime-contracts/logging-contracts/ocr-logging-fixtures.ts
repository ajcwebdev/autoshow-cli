import type { OcrCostFixture, OcrCostStepFixture, OcrDiagnosticFixture, OcrStepFixture, WriteManifestMetadata } from '~/types'

const createOcrCostFixture = (
  estimatedTotalCost: number,
  estimatedSteps: OcrCostStepFixture[],
  actualTotalCost: number,
  actualSteps: OcrCostStepFixture[],
  ocrDiagnostics: OcrDiagnosticFixture[]
): OcrCostFixture => ({
  estimated: {
    totalCost: estimatedTotalCost,
    steps: estimatedSteps
  },
  actual: {
    totalCost: actualTotalCost,
    steps: actualSteps
  },
  ocrDiagnostics
})

const createOcrDiagnostic = (
  fixture: OcrDiagnosticFixture
): OcrDiagnosticFixture => fixture

export const createOcrCostDiagnosticsMetadata = (): WriteManifestMetadata => ({
  step2: {
    extractionMethod: 'pdf+openai-ocr',
    totalPages: 2,
    ocrPages: 2,
    textPages: 0,
    processingTime: 1234,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 5000,
    ocrService: 'openai',
    ocrModel: 'gpt-5.4-nano',
    promptTokens: 6000,
    completionTokens: 1500
  } satisfies OcrStepFixture,
  cost: createOcrCostFixture(
    0.58044,
    [{
      step: 'extract',
      provider: 'openai',
      model: 'gpt-5.4-nano',
      cost: 0.58044,
      pageCount: 2,
      promptTokens: 5972,
      completionTokens: 3688,
      inputCostPer1MCents: 20,
      outputCostPer1MCents: 125,
      estimateType: 'heuristic'
    }],
    0.3075,
    [{
      step: 'extract',
      provider: 'openai',
      model: 'gpt-5.4-nano',
      cost: 0.3075,
      inputMetric: 'tokens',
      inputValue: 7500,
      promptTokens: 6000,
      completionTokens: 1500
    }],
    [
      createOcrDiagnostic({
        provider: 'openai',
        model: 'gpt-5.4-nano',
        pages: 2,
        predictedCostInputs: {
          costCents: 0.58044,
          pageCount: 2,
          inputMetric: 'tokens',
          inputValue: 9660,
          promptTokens: 5972,
          completionTokens: 3688,
          estimateType: 'heuristic'
        },
        actualCostInputs: {
          costCents: 0.3075,
          pageCount: 2,
          inputMetric: 'tokens',
          inputValue: 7500,
          promptTokens: 6000,
          completionTokens: 1500
        },
        ratesUsed: {
          inputCostPer1MCents: 20,
          outputCostPer1MCents: 125
        },
        delta: {
          costCents: -0.27294,
          percent: -47.02294810833162
        }
      }),
      createOcrDiagnostic({
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        pages: 690,
        predictedCostInputs: {
          costCents: 60,
          pageCount: 690,
          inputMetric: 'tokens',
          inputValue: 900000,
          promptTokens: 600000,
          completionTokens: 300000,
          estimateType: 'heuristic'
        },
        actualCostInputs: {
          costCents: 74,
          pageCount: 690,
          inputMetric: 'tokens',
          inputValue: 1208345,
          promptTokens: 806511,
          completionTokens: 401834,
          schemaRetryUsage: {
            count: 3,
            pages: [38, 447, 660],
            promptTokens: 30000,
            completionTokens: 111696
          }
        },
        ratesUsed: {
          inputCostPer1MCents: 10,
          outputCostPer1MCents: 40
        },
        delta: {
          costCents: 14,
          percent: 23.333333333333332
        }
      })
    ]
  )
})

export const createPartialOcrDiagnosticsMetadata = (): WriteManifestMetadata => ({
  step2: [{
    extractionMethod: 'gemini-ocr',
    totalPages: 228,
    ocrPages: 228,
    textPages: 0,
    processingTime: 180000,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 200000,
    ocrService: 'gemini',
    ocrModel: 'gemini-3.5-flash',
    promptTokens: 800000,
    completionTokens: 100000
  } satisfies OcrStepFixture],
  partialStep2: [{
    extractionMethod: 'kimi-ocr',
    totalPages: 228,
    ocrPages: 227,
    textPages: 0,
    processingTime: 600000,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 190000,
    ocrService: 'kimi',
    ocrModel: 'kimi-latest',
    promptTokens: 971207,
    completionTokens: 107681,
    providerCostSource: 'partial_provider_usage',
    status: 'failed_partial',
    artifactDir: 'providers/kimi-kimi-latest',
    completedPages: 227,
    failedPages: 1,
    failure: {
      message: 'Kimi OCR page 9 timed out after 10m',
      category: 'timeout',
      failureKind: 'timeout',
      retryable: true
    }
  }],
  cost: createOcrCostFixture(
    1,
    [{
      step: 'extract',
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      cost: 0.25,
      pageCount: 228,
      promptTokens: 800000,
      completionTokens: 100000
    }, {
      step: 'extract',
      provider: 'kimi',
      model: 'kimi-latest',
      cost: 0.75,
      pageCount: 228,
      promptTokens: 1000000,
      completionTokens: 120000
    }],
    0.9,
    [{
      step: 'extract',
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      cost: 0.2,
      costSource: 'provider_usage',
      inputMetric: 'tokens',
      inputValue: 900000,
      promptTokens: 800000,
      completionTokens: 100000
    }, {
      step: 'extract',
      provider: 'kimi',
      model: 'kimi-latest',
      cost: 0.7,
      costSource: 'partial_provider_usage',
      inputMetric: 'tokens',
      inputValue: 1078888,
      promptTokens: 971207,
      completionTokens: 107681
    }],
    [
      createOcrDiagnostic({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        pages: 228,
        predictedCostInputs: {
          costCents: 0.25,
          pageCount: 228,
          promptTokens: 800000,
          completionTokens: 100000
        },
        actualCostInputs: {
          costCents: 0.2,
          pageCount: 228,
          inputMetric: 'tokens',
          inputValue: 900000,
          promptTokens: 800000,
          completionTokens: 100000,
          costSource: 'provider_usage'
        },
        delta: { costCents: -0.05 }
      }),
      createOcrDiagnostic({
        provider: 'kimi',
        model: 'kimi-latest',
        status: 'failed_partial',
        pages: 228,
        completedPages: 227,
        failedPages: 1,
        predictedCostInputs: {
          costCents: 0.75,
          pageCount: 228,
          promptTokens: 1000000,
          completionTokens: 120000
        },
        actualCostInputs: {
          costCents: 0.7,
          pageCount: 227,
          status: 'failed_partial',
          totalPages: 228,
          failedPages: 1,
          inputMetric: 'tokens',
          inputValue: 1078888,
          promptTokens: 971207,
          completionTokens: 107681,
          costSource: 'partial_provider_usage'
        },
        delta: { costCents: -0.05 }
      })
    ]
  ),
  timing: {
    actual: {
      totalProcessingTimeMs: 780000,
      steps: [{
        step: 'extract',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        processingTimeMs: 180000,
        inputMetric: 'pages',
        inputValue: 228
      }, {
        step: 'extract',
        provider: 'kimi',
        model: 'kimi-latest',
        processingTimeMs: 600000,
        inputMetric: 'pages',
        inputValue: 227
      }]
    }
  }
})
