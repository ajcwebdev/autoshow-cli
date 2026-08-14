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

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const IsoDateSchema = v.pipe(
  v.string(),
  v.check(isIsoDate, 'Expected an ISO calendar date in YYYY-MM-DD form.')
)

export const ModelLifecycleSchema = v.pipe(
  v.strictObject({
    status: v.picklist(['active', 'deprecated']),
    shutdownDate: v.optional(IsoDateSchema, undefined),
    replacementModel: v.optional(v.pipe(v.string(), v.nonEmpty()), undefined),
    defaultEligible: v.optional(v.boolean(), true),
    allExpansionEligible: v.optional(v.boolean(), true),
    sourceUrl: v.optional(v.pipe(v.string(), v.url()), undefined),
    checkedAt: v.optional(IsoDateSchema, undefined),
    notes: v.optional(v.pipe(v.string(), v.nonEmpty()), undefined)
  }),
  v.check(
    (lifecycle) => lifecycle.status !== 'deprecated'
      || (lifecycle.sourceUrl !== undefined && lifecycle.checkedAt !== undefined && lifecycle.notes !== undefined),
    'Deprecated model lifecycle metadata requires a source URL, checked date, and notes.'
  ),
  v.check(
    (lifecycle) => lifecycle.status === 'deprecated'
      || (lifecycle.shutdownDate === undefined
        && lifecycle.replacementModel === undefined
        && lifecycle.defaultEligible
        && lifecycle.allExpansionEligible),
    'Active models cannot declare retirement data or opt out of automatic selection.'
  )
)

type LifecycleRegistryService = {
  models: Record<string, {
    lifecycle?: {
      replacementModel?: string | undefined
    } | undefined
  }>
}

const isMovingLatestAlias = (model: string): boolean =>
  /(?:^|[-_/])latest(?:$|[-_/])/i.test(model)

const hasValidLifecycleReferences = (service: LifecycleRegistryService): boolean =>
  Object.entries(service.models).every(([model, metadata]) => {
    const replacement = metadata.lifecycle?.replacementModel
    return replacement === undefined
      || (replacement !== model && service.models[replacement] !== undefined && !isMovingLatestAlias(replacement))
  })

const hasNoMovingLatestAliases = (service: LifecycleRegistryService): boolean =>
  Object.keys(service.models).every((model) => !isMovingLatestAlias(model))

const TokenPricingBandSchema = v.strictObject({
  label: v.optional(v.string(), undefined),
  minInputTokens: v.optional(v.pipe(v.number(), v.minValue(0)), undefined),
  maxInputTokens: v.optional(v.pipe(v.number(), v.minValue(0)), undefined),
  inputCostPer1MCents: v.number(),
  cachedInputCostPer1MCents: v.optional(v.number(), undefined),
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

const SttModelSchema = v.strictObject({
  description: v.string(),
  ...PricingProvenanceFields,
  costPerHourCents: v.number(),
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

export const ReasoningCapabilitiesSchema = v.pipe(
  v.strictObject({
    support: v.picklist(['unsupported', 'optional', 'required']),
    allowDisabled: v.optional(v.boolean(), undefined),
    supportedEfforts: v.optional(v.array(v.picklist(['minimal', 'low', 'medium', 'high', 'max'])), undefined)
  }),
  v.check(
    (capabilities) => capabilities.support !== 'unsupported'
      || (capabilities.allowDisabled === undefined && capabilities.supportedEfforts === undefined),
    'Unsupported reasoning capabilities cannot declare disable or named-effort controls.'
  ),
  v.check(
    (capabilities) => capabilities.support !== 'required' || capabilities.allowDisabled !== true,
    'Required reasoning capabilities cannot allow reasoning to be disabled.'
  )
)

const ExtractModelSchema = v.pipe(
  v.strictObject({
    description: v.string(),
    ...PricingProvenanceFields,
    costPer1kPagesCents: v.optional(v.number(), undefined),
    costPerMInputTokensCents: v.optional(v.number(), undefined),
    costPerMCachedInputTokensCents: v.optional(v.number(), undefined),
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
    }), undefined),
    reasoning: v.optional(ReasoningCapabilitiesSchema, undefined),
    lifecycle: v.optional(ModelLifecycleSchema, undefined)
  }),
  v.check(
    (model) => model.costPerMInputTokensCents === undefined
      || model.costPerMOutputTokensCents === undefined
      || (model.estimation?.costMultiplier ?? 1) === 1,
    'Token-priced OCR models must use costMultiplier 1; calibrate prompt and completion token shapes instead.'
  )
)

const ExtractServiceSchema = v.pipe(
  v.object({
    description: v.string(),
    type: v.picklist(['local', 'api']),
    models: v.record(v.string(), ExtractModelSchema)
  }),
  v.check(
    (service) => hasValidLifecycleReferences(service),
    'Model lifecycle replacements must name another concrete selector in the same extract service.'
  ),
  v.check(
    (service) => hasNoMovingLatestAliases(service),
    'Moving *-latest aliases are not valid extract model selectors.'
  )
)

const LlmModelSchema = v.strictObject({
  description: v.string(),
  ...PricingProvenanceFields,
  inputCostPer1MCents: v.number(),
  cachedInputCostPer1MCents: v.optional(v.number(), undefined),
  outputCostPer1MCents: v.number(),
  tokenPricingBands: v.optional(v.array(TokenPricingBandSchema), undefined),
  higherContextPricing: v.optional(HigherContextPricingSchema, undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPer1KTokens: v.optional(v.number(), undefined)
  }), undefined),
  reasoning: v.optional(ReasoningCapabilitiesSchema, undefined),
  lifecycle: v.optional(ModelLifecycleSchema, undefined)
})

const LlmServiceSchema = v.pipe(
  v.object({
    description: v.string(),
    type: v.picklist(['local', 'api']),
    models: v.record(v.string(), LlmModelSchema)
  }),
  v.check(
    (service) => hasValidLifecycleReferences(service),
    'Model lifecycle replacements must name another concrete selector in the same LLM service.'
  ),
  v.check(
    (service) => hasNoMovingLatestAliases(service),
    'Moving *-latest aliases are not valid LLM model selectors.'
  )
)

const TtsModelSchema = v.strictObject({
  description: v.string(),
  ...PricingProvenanceFields,
  costPerRequestCents: v.optional(v.number(), undefined),
  costPer1kCharsCents: v.optional(v.number(), undefined),
  inputCostPer1MCharsCents: v.optional(v.number(), undefined),
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
  catalogSourceUrl: v.optional(v.string(), undefined),
  catalogCheckedAt: v.optional(v.string(), undefined),
  catalogNotes: v.optional(v.string(), undefined),
  voices: v.optional(v.array(v.string()), undefined),
  models: v.record(v.string(), TtsModelSchema)
})

const ImageReferenceCapabilitiesSchema = v.strictObject({
  supported: v.boolean(),
  maxInputs: v.pipe(v.number(), v.integer(), v.minValue(0))
})

const ImageModelSchema = v.strictObject({
  description: v.string(),
  ...PricingProvenanceFields,
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

const MusicModelSchema = v.strictObject({
  description: v.string(),
  ...PricingProvenanceFields,
  costPerTrackCents: v.optional(v.number(), undefined),
  costPerMinuteCents: v.optional(v.number(), undefined),
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

const VideoModelSchema = v.strictObject({
  description: v.string(),
  ...PricingProvenanceFields,
  baseCostPerSecondCents: v.optional(v.number(), undefined),
  baseJobFeeCents: v.optional(v.number(), undefined),
  resolutionMultiplier720p: v.optional(v.number(), undefined),
  resolutionMultiplier1080p: v.optional(v.number(), undefined),
  blockSizeSec: v.optional(v.number(), undefined),
  blockCost720pCents: v.optional(v.number(), undefined),
  blockCost1080pCents: v.optional(v.number(), undefined),
  fixedCostByResolutionDurationCents: v.optional(VideoFixedCostMatrixSchema, undefined),
  inputImageCostCents: v.optional(v.number(), undefined),
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
