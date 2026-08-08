import * as v from 'valibot'

const SttEstimationSchema = v.object({
  costMultiplier: v.optional(v.number(), undefined),
  msPerSecond: v.optional(v.number(), undefined)
})

const SttBillingSchema = v.object({
  roundingIncrementSeconds: v.optional(v.number(), undefined),
  minimumSeconds: v.optional(v.number(), undefined)
})

const PricingProvenanceFields = {
  pricingSourceUrl: v.optional(v.string(), undefined),
  pricingCheckedAt: v.optional(v.string(), undefined),
  pricingCurrency: v.optional(v.string(), undefined),
  pricingTier: v.optional(v.string(), undefined),
  pricingNotes: v.optional(v.string(), undefined)
}

const TokenPricingBandSchema = v.object({
  label: v.optional(v.string(), undefined),
  minInputTokens: v.optional(v.pipe(v.number(), v.minValue(0)), undefined),
  maxInputTokens: v.optional(v.pipe(v.number(), v.minValue(0)), undefined),
  inputCostPer1MUSD: v.optional(v.number(), undefined),
  inputCostPer1MCents: v.number(),
  cachedInputCostPer1MUSD: v.optional(v.number(), undefined),
  cachedInputCostPer1MCents: v.optional(v.number(), undefined),
  outputCostPer1MUSD: v.optional(v.number(), undefined),
  outputCostPer1MCents: v.number(),
  note: v.optional(v.string(), undefined)
})

const HigherContextPricingSchema = v.object({
  thresholdInputTokens: v.pipe(v.number(), v.minValue(0)),
  note: v.string()
})

export const SttLimitsSchema = v.object({
  effectiveBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  directUploadBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  remoteUrlBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  durationSeconds: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  requestBudgetSeconds: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  notes: v.optional(v.string(), undefined)
})

const SttModelSchema = v.object({
  description: v.string(),
  ...PricingProvenanceFields,
  costPerHourUSD: v.optional(v.number(), undefined),
  costPerHourCents: v.optional(v.number(), undefined),
  billing: v.optional(SttBillingSchema, undefined),
  estimation: v.optional(SttEstimationSchema, undefined),
  limits: v.optional(SttLimitsSchema, undefined)
})

const SttServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), SttModelSchema)
})

export const ExtractLimitsSchema = v.object({
  effectiveBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  imageBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  pdfBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  pageCount: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  notes: v.optional(v.string(), undefined)
})

const ExtractModelSchema = v.object({
  description: v.string(),
  ...PricingProvenanceFields,
  costPer1kPagesUSD: v.optional(v.number(), undefined),
  costPer1kPagesCents: v.optional(v.number(), undefined),
  costPerMInputTokensUSD: v.optional(v.number(), undefined),
  costPerMInputTokensCents: v.optional(v.number(), undefined),
  costPerMCachedInputTokensUSD: v.optional(v.number(), undefined),
  costPerMCachedInputTokensCents: v.optional(v.number(), undefined),
  costPerMOutputTokensUSD: v.optional(v.number(), undefined),
  costPerMOutputTokensCents: v.optional(v.number(), undefined),
  tokenPricingBands: v.optional(v.array(TokenPricingBandSchema), undefined),
  higherContextPricing: v.optional(HigherContextPricingSchema, undefined),
  limits: v.optional(ExtractLimitsSchema, undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerPage: v.optional(v.number(), undefined),
    singlePagePdfFallbackMsPerPage: v.optional(v.number(), undefined),
    promptTokensPerPage: v.optional(v.number(), undefined),
    completionTokensPerPage: v.optional(v.number(), undefined)
  }), undefined)
})

const ExtractServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), ExtractModelSchema)
})

const LlmModelSchema = v.object({
  description: v.string(),
  ...PricingProvenanceFields,
  inputCostPer1MUSD: v.number(),
  inputCostPer1MCents: v.number(),
  cachedInputCostPer1MUSD: v.optional(v.number(), undefined),
  cachedInputCostPer1MCents: v.optional(v.number(), undefined),
  outputCostPer1MUSD: v.number(),
  outputCostPer1MCents: v.number(),
  tokenPricingBands: v.optional(v.array(TokenPricingBandSchema), undefined),
  higherContextPricing: v.optional(HigherContextPricingSchema, undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPer1KTokens: v.optional(v.number(), undefined)
  }), undefined)
})

const LlmServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), LlmModelSchema)
})

const TtsModelSchema = v.object({
  description: v.string(),
  ...PricingProvenanceFields,
  costPer1kCharsUSD: v.optional(v.number(), undefined),
  costPer1kCharsCents: v.optional(v.number(), undefined),
  inputCostPer1MCharsUSD: v.optional(v.number(), undefined),
  inputCostPer1MCharsCents: v.optional(v.number(), undefined),
  outputCostPer1MCharsUSD: v.optional(v.number(), undefined),
  outputCostPer1MCharsCents: v.optional(v.number(), undefined),
  hfRepo: v.optional(v.string(), undefined),
  limits: v.optional(v.object({
    maxInputCharacters: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
  }), undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPer1KChars: v.optional(v.number(), undefined)
  }), undefined)
})

const TtsServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  voices: v.optional(v.array(v.string()), undefined),
  models: v.record(v.string(), TtsModelSchema)
})

const ImageReferenceCapabilitiesSchema = v.strictObject({
  supported: v.boolean(),
  maxInputs: v.pipe(v.number(), v.integer(), v.minValue(0))
})

const ImageModelSchema = v.object({
  description: v.string(),
  ...PricingProvenanceFields,
  costPerImageUSD: v.number(),
  costPerImageCents: v.number(),
  referenceImages: v.optional(ImageReferenceCapabilitiesSchema, undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerImage: v.optional(v.number(), undefined)
  }), undefined)
})

const ImageServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  referenceImages: ImageReferenceCapabilitiesSchema,
  models: v.record(v.string(), ImageModelSchema)
})

const MusicModelSchema = v.object({
  description: v.string(),
  ...PricingProvenanceFields,
  costPerTrackUSD: v.optional(v.number(), undefined),
  costPerTrackCents: v.optional(v.number(), undefined),
  costPerMinuteUSD: v.optional(v.number(), undefined),
  costPerMinuteCents: v.optional(v.number(), undefined),
  lyricsCostPerTrackUSD: v.optional(v.number(), undefined),
  lyricsCostPerTrackCents: v.optional(v.number(), undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerSecond: v.optional(v.number(), undefined)
  }), undefined)
})

const MusicServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), MusicModelSchema)
})

const VideoFixedCostMatrixSchema = v.record(
  v.string(),
  v.record(v.string(), v.number())
)

const VideoCostPerSecondByResolutionSchema = v.record(
  v.string(),
  v.number()
)

const VideoModelSchema = v.object({
  description: v.string(),
  ...PricingProvenanceFields,
  baseCostPerSecondUSD: v.optional(v.number(), undefined),
  baseCostPerSecondCents: v.optional(v.number(), undefined),
  baseJobFeeUSD: v.optional(v.number(), undefined),
  baseJobFeeCents: v.optional(v.number(), undefined),
  resolutionMultiplier720p: v.optional(v.number(), undefined),
  resolutionMultiplier1080p: v.optional(v.number(), undefined),
  blockSizeSec: v.optional(v.number(), undefined),
  blockCost720pUSD: v.optional(v.number(), undefined),
  blockCost720pCents: v.optional(v.number(), undefined),
  blockCost1080pUSD: v.optional(v.number(), undefined),
  blockCost1080pCents: v.optional(v.number(), undefined),
  fixedCostByResolutionDurationCents: v.optional(VideoFixedCostMatrixSchema, undefined),
  inputImageCostUSD: v.optional(v.number(), undefined),
  inputImageCostCents: v.optional(v.number(), undefined),
  inputVideoCostPerSecondUSD: v.optional(v.number(), undefined),
  inputVideoCostPerSecondCents: v.optional(v.number(), undefined),
  costPerSecondByResolutionCents: v.optional(VideoCostPerSecondByResolutionSchema, undefined),
  audioCostPerSecondByResolutionCents: v.optional(VideoCostPerSecondByResolutionSchema, undefined),
  videoInputCostPerSecondByResolutionCents: v.optional(VideoCostPerSecondByResolutionSchema, undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerSecond: v.optional(v.number(), undefined)
  }), undefined)
})

const VideoServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  resolutions: v.optional(v.array(v.string()), undefined),
  billedDurations: v.optional(v.array(v.number()), undefined),
  models: v.record(v.string(), VideoModelSchema)
})

export const SttRegistrySchema = v.record(v.string(), SttServiceSchema)
export const LlmRegistrySchema = v.record(v.string(), LlmServiceSchema)
export const TtsRegistrySchema = v.record(v.string(), TtsServiceSchema)
export const ImageRegistrySchema = v.record(v.string(), ImageServiceSchema)
export const MusicRegistrySchema = v.record(v.string(), MusicServiceSchema)
export const VideoRegistrySchema = v.record(v.string(), VideoServiceSchema)
export const ExtractRegistrySchema = v.record(v.string(), ExtractServiceSchema)

export const ModelRegistrySchema = v.object({
  stt: SttRegistrySchema,
  extract: ExtractRegistrySchema,
  llm: LlmRegistrySchema,
  tts: TtsRegistrySchema,
  image: ImageRegistrySchema,
  music: MusicRegistrySchema,
  video: VideoRegistrySchema
})
