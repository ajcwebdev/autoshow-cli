// Comic draft-scenes stage enumeration shared by the flag definitions and the argument coercion, so
// help lists exactly the values the readers accept.
export const DRAFT_SCENES_ONLY_VALUES = ['prepare', 'scene', 'panel-prompts'] as const
export type DraftScenesOnlyValue = typeof DRAFT_SCENES_ONLY_VALUES[number]

// Former local stages now merged into prepare; selecting one gets a diagnostic naming the replacement.
export const RETIRED_PREPARE_ONLY_VALUES = ['structure', 'prompt'] as const
