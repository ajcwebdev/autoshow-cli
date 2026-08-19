export type OcrStepFixture = {
  extractionMethod: string
  totalPages: number
  ocrPages: number
  textPages: number
  processingTime: number
  dpi: number
  languages: string
  tokenEstimate: number
  ocrService: string
  ocrModel: string
  promptTokens: number
  completionTokens: number
}

export type OcrCostStepFixture = {
  step: 'extract'
  provider: string
  model: string
  cost: number
  pageCount?: number
  promptTokens: number
  completionTokens: number
  costSource?: 'provider_usage' | 'partial_provider_usage'
  inputMetric?: 'tokens'
  inputValue?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  estimateType?: 'heuristic'
}

export type OcrCostInputsFixture = {
  costCents: number
  pageCount: number
  inputMetric?: 'tokens'
  inputValue?: number
  promptTokens: number
  completionTokens: number
  estimateType?: 'heuristic'
  costSource?: 'provider_usage' | 'partial_provider_usage'
  status?: 'failed_partial'
  totalPages?: number
  failedPages?: number
  schemaRetryUsage?: {
    count: number
    pages: number[]
    promptTokens: number
    completionTokens: number
  }
}

export type OcrDiagnosticFixture = {
  provider: string
  model: string
  pages: number
  status?: 'failed_partial'
  completedPages?: number
  failedPages?: number
  predictedCostInputs: OcrCostInputsFixture
  actualCostInputs: OcrCostInputsFixture
  ratesUsed?: {
    inputCostPer1MCents: number
    outputCostPer1MCents: number
  }
  delta: {
    costCents: number
    percent?: number
  }
}

export type OcrCostFixture = {
  estimated: {
    totalCost: number
    steps: OcrCostStepFixture[]
  }
  actual: {
    totalCost: number
    steps: OcrCostStepFixture[]
  }
  ocrDiagnostics: OcrDiagnosticFixture[]
}
