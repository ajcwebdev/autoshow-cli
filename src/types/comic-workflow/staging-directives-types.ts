import type { StructuredScriptData } from '~/types'

export type StagingDirectiveKind = 'blocking' | 'camera' | 'axis-break' | 'costume' | 'extras' | 'skip-panels'

export type StructuredStaging = NonNullable<StructuredScriptData['staging']>

export type StagingPanelTarget = StructuredStaging['camera'][number]['panel']

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
