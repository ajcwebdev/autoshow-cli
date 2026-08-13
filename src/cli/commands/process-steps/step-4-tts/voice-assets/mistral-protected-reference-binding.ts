import type { ProtectedAssetRef, TtsOptions } from '~/types'
import { InternalError } from '~/utils/error-handler'

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

// Protected references are execution-only capabilities, not runtime options. A WeakMap keeps the
// resolver out of logs/artifacts and deliberately binds it to one exact, sanitized options object:
// spreading or otherwise cloning that object cannot copy or reuse the capability.
const bindingByOptions = new WeakMap<TtsOptions, MistralProtectedReferenceBinding>()
const speakerBindingByOptions = new WeakMap<TtsOptions, MistralProtectedSpeakerReferenceBinding>()

export const attachMistralProtectedReference = <T extends TtsOptions>(
  options: T,
  binding: MistralProtectedReferenceBinding
): T => {
  if (bindingByOptions.has(options)) {
    throw InternalError('Mistral protected reference capability is already attached to this runtime options object.', { stage: 'tts:mistral' })
  }
  bindingByOptions.set(options, binding)
  return options
}

export const promoteMistralProtectedReference = <T extends TtsOptions>(
  options: T,
  binding: MaterializedMistralProtectedReferenceBinding
): T => {
  const current = bindingByOptions.get(options)
  if (
    current?.materialization !== 'non-materialized'
    || current.protectedAsset.storeId !== binding.protectedAsset.storeId
    || current.protectedAsset.assetId !== binding.protectedAsset.assetId
    || current.protectedAsset.sha256 !== binding.protectedAsset.sha256
    || current.sourceExtension !== binding.sourceExtension
  ) {
    throw InternalError('Mistral protected reference promotion does not match its exact planning capability.', { stage: 'tts:mistral' })
  }
  bindingByOptions.set(options, binding)
  return options
}

export const getMistralProtectedReference = (
  options: TtsOptions
): MistralProtectedReferenceBinding | undefined => bindingByOptions.get(options)

const sameSpeakerReferenceIdentity = (
  left: PlannedMistralProtectedSpeakerReference,
  right: PlannedMistralProtectedSpeakerReference
): boolean =>
  left.speakerKey === right.speakerKey
  && left.sourceExtension === right.sourceExtension
  && left.protectedAsset.storeId === right.protectedAsset.storeId
  && left.protectedAsset.assetId === right.protectedAsset.assetId
  && left.protectedAsset.sha256 === right.protectedAsset.sha256

export const attachMistralProtectedSpeakerReferences = <T extends TtsOptions>(
  options: T,
  binding: Extract<MistralProtectedSpeakerReferenceBinding, { materialization: 'non-materialized' }>
): T => {
  if (speakerBindingByOptions.has(options)) {
    throw InternalError('Mistral protected speaker-reference capability is already attached to this runtime options object.', { stage: 'tts:mistral' })
  }
  speakerBindingByOptions.set(options, binding)
  return options
}

export const promoteMistralProtectedSpeakerReferences = <T extends TtsOptions>(
  options: T,
  binding: Extract<MistralProtectedSpeakerReferenceBinding, { materialization: 'materialized' }>
): T => {
  const current = speakerBindingByOptions.get(options)
  if (
    current?.materialization !== 'non-materialized'
    || current.entries.length !== binding.entries.length
    || current.entries.some((entry, index) => {
      const promoted = binding.entries[index]
      return !promoted || !sameSpeakerReferenceIdentity(entry, promoted)
    })
  ) {
    throw InternalError('Mistral protected speaker-reference promotion does not match its exact planning capability.', { stage: 'tts:mistral' })
  }
  speakerBindingByOptions.set(options, binding)
  return options
}

export const getMistralProtectedSpeakerReferences = (
  options: TtsOptions
): MistralProtectedSpeakerReferenceBinding | undefined => speakerBindingByOptions.get(options)

export const hasMistralProtectedReferences = (options: TtsOptions): boolean =>
  bindingByOptions.has(options) || speakerBindingByOptions.has(options)
