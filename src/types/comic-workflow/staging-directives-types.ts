import type { StructuredScriptData } from '~/types'

export type StagingDirectiveKind = 'blocking' | 'camera' | 'axis-break' | 'costume' | 'extras' | 'skip-panels'

export type StructuredStaging = NonNullable<StructuredScriptData['staging']>

export type StagingBlockingDirective = StructuredStaging['blocking'][number]

export type StagingCameraDirective = StructuredStaging['camera'][number]

export type StagingCostumeDirective = StructuredStaging['costume'][number]

export type StagingExtrasDirective = StructuredStaging['extras'][number]

export type StagingSkipPanelsDirective = NonNullable<StructuredStaging['skipPanels']>

export type StagingPanelTarget = StagingCameraDirective['panel']

export type LocatedStagingDirective = {
  kind: StagingDirectiveKind
  label: string
  header: Record<string, string>
  text: string
  startUtf16: number
  endUtf16: number
  lineIndex: number
}

export type StagingDirectiveClassification = {
  kind: 'staging-directive'
  waitsForPrompt: boolean
} | {
  kind: 'staging-directive-prompt'
}
