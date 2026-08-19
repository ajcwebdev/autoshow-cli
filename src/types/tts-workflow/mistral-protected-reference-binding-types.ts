import type { ProtectedAssetRef } from '~/types'

export type PlannedMistralProtectedReferenceBinding = Readonly<{
  materialization: 'non-materialized'
  protectedAsset: ProtectedAssetRef
  sourceExtension: string
}>

export type MaterializedMistralProtectedReferenceBinding = Readonly<{
  materialization: 'materialized'
  protectedAsset: ProtectedAssetRef
  sourceExtension: string
  resolve: () => Promise<string>
}>

export type MistralProtectedReferenceBinding =
  | PlannedMistralProtectedReferenceBinding
  | MaterializedMistralProtectedReferenceBinding

export type PlannedMistralProtectedSpeakerReference = Readonly<{
  speakerKey: string
  protectedAsset: ProtectedAssetRef
  sourceExtension: string
}>

export type MaterializedMistralProtectedSpeakerReference = PlannedMistralProtectedSpeakerReference & Readonly<{
  resolve: () => Promise<string>
}>

export type MistralProtectedSpeakerReferenceBinding =
  | Readonly<{
      materialization: 'non-materialized'
      entries: readonly PlannedMistralProtectedSpeakerReference[]
    }>
  | Readonly<{
      materialization: 'materialized'
      entries: readonly MaterializedMistralProtectedSpeakerReference[]
    }>
