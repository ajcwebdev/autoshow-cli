export const TREATMENT_STAGE = 'comic:draft-treatment'

export const TREATMENT_SCHEMA_NAME = 'treatment_draft_v1'

export const TREATMENT_DRAFT_MAX_ATTEMPTS = 2

export const TREATMENT_OUTPUT_UNITS_FIXED = 1200

export const TREATMENT_OUTPUT_UNITS_PER_PANEL = 260

export const DEFAULT_TREATMENT_PANEL_COUNT = 10

export const MAX_TREATMENT_PANEL_COUNT = 60

export const DEFAULT_TREATMENT_SCENE_NUMBER = '01'

export const DEFAULT_TREATMENT_CATALOG_POLICY = 'skip-existing'

export const TREATMENT_CATALOG_POLICIES = ['skip-existing', 'fail'] as const

export const TREATMENT_VOICE_PACINGS = ['exclusive', 'mixed'] as const

export const DEFAULT_TREATMENT_VOICE_PACING = 'exclusive'

export const NARRATION_SPEAKER_LABEL = 'NARRATION'

export const TREATMENT_METADATA_LABEL = 'Treatment'
