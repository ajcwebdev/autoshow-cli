import type { InferOutput } from 'valibot'
import type { ModelRegistry } from '~/types'
import type { ExtractLimitsSchema, SttLimitsSchema } from '~/cli/commands/setup-and-utilities/models/model-loader/model-loader-schemas'

export type CliFlagDefinition = {
  description: string
  type:
    | BooleanConstructor
    | StringConstructor
    | [StringConstructor]
    | readonly [StringConstructor]
  default?: unknown
  short?: string
  negatable?: boolean
  help?: Record<string, unknown> & {
    hidden?: boolean
  }
}

export type CliFlagsDefinition = Record<string, CliFlagDefinition>

export type CliParameterDefinition = {
  key: string
  description?: string
}

export type CliFlagOccurrence = {
  name: string
  raw: string
  value: string | boolean
  known: boolean
}

type CliHelpGroup = readonly [key: string, label: string]

export type CliRawParsed = {
  doubleDash: string[]
  explicitFlags: Set<string>
  flagOccurrences: CliFlagOccurrence[]
  flagOccurrenceIndices: number[]
  unknown: Record<string, unknown>
  positionals: Array<{ value: string, index: number }>
}

export type CliParameterValues = Record<string, string | string[]> & {
  input: string
  outputDirs: string[]
  prompt: string
}

export type CliFlagValues = Record<string, unknown> & {
  doctor?: unknown
  models?: unknown
  repeat?: unknown
  step?: unknown
}

export type CliCommandContext = {
  argv: string[]
  calledAs?: string
  command?: CliCommandDefinition
  flags: CliFlagValues
  parameters: CliParameterValues
  rawParsed: CliRawParsed
  store: Record<string, unknown>
}

export type CliCommandHandler = (ctx: CliCommandContext) => void | Promise<void>

export type CliCommandDefinition = {
  name: string
  description: string
  parameters?: readonly CliParameterDefinition[]
  flags?: CliFlagsDefinition
  subcommands?: readonly CliCommandDefinition[]
  help?: {
    group?: string
    examples?: ReadonlyArray<readonly [command: string, description: string]>
    notes?: readonly string[]
  }
  allowUnknownFlags?: boolean
  allowExcessParameters?: boolean
  passThroughHelpAfterFirstPositional?: boolean
  handler: CliCommandHandler
}

export type CliRootDefinition = {
  scriptName: string
  description: string
  version: string
  globalFlags: CliFlagsDefinition
  commandGroups: readonly CliHelpGroup[]
  flagGroups: readonly CliHelpGroup[]
}


export type CostEstimation = {
  costMultiplier: number
}

export type DurationBilledEstimation = CostEstimation & {
  msPerSecond: number
}

export type ExtractEstimation = CostEstimation & {
  msPerPage: number
  singlePagePdfFallbackMsPerPage?: number
  promptTokensPerPage?: number
  completionTokensPerPage?: number
}

export type ExtractLimits = InferOutput<typeof ExtractLimitsSchema>

export type ImageEstimation = CostEstimation & {
  msPerImage: number
}

export type LlmEstimation = CostEstimation & {
  msPer1KTokens: number
}

export type ModelConfigLoadOptions = {
  fragmentFilenamePrefix?: string
}

export type MusicModelMeta = ModelRegistry['music'][string]['models'][string]

export type SttLimits = InferOutput<typeof SttLimitsSchema>

export type TtsEstimation = CostEstimation & {
  msPer1KChars: number
}

export type VideoModelMeta = ModelRegistry['video'][string]['models'][string]
