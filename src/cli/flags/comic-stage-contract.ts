// Comic stage and promotion-policy enumerations shared by the flag definitions and the argument
// coercion, so help lists exactly the values the readers accept.
export const DRAFT_SCENES_ONLY_VALUES = ['structure', 'prompt', 'blocking', 'scene', 'panel-prompts'] as const
export type DraftScenesOnlyValue = typeof DRAFT_SCENES_ONLY_VALUES[number]

export const COMIC_REVISION_PROMOTION_POLICIES = ['clear-winners'] as const
export type ComicRevisionPromotionPolicy = typeof COMIC_REVISION_PROMOTION_POLICIES[number]
