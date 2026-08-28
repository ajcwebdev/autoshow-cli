export type ModelFlag<Registry extends readonly { flagName: string, selection: { type: string } }[]> =
  Extract<Registry[number], { selection: { type: 'models' } }>['flagName']

export type RepeatableModelFlag =
  (typeof import('~/cli/flags/service-selector-normalization/repeatable-model-flags').REPEATABLE_MODEL_FLAGS)[number]
