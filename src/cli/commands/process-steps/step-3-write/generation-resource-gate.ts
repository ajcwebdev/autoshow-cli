import type { GenerationResourceGate, GenerationResourceGateOptions } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { createResourceGate, normalizeResourceGateCapacity } from '~/utils/resource-gate'

const DEFAULT_GENERATION_RESOURCE_CAPACITY = DEFAULT_CLI_CONCURRENCY

const normalizeCapacity = (value: unknown, fallback = DEFAULT_GENERATION_RESOURCE_CAPACITY): number =>
  normalizeResourceGateCapacity(value, fallback)

export const createGenerationResourceGate = (
  options: GenerationResourceGateOptions = {}
): GenerationResourceGate =>
  createResourceGate({ capacity: normalizeCapacity(options.capacity) })

export const resolveGenerationResourceCapacity = (options: {
  ttsProviderConcurrency?: number | undefined
  imageProviderConcurrency?: number | undefined
  videoProviderConcurrency?: number | undefined
  musicProviderConcurrency?: number | undefined
  ttsLocalConcurrency?: number | undefined
  imageLocalConcurrency?: number | undefined
  videoLocalConcurrency?: number | undefined
  musicLocalConcurrency?: number | undefined
}): number => normalizeCapacity(undefined, Math.max(
  1,
  options.ttsProviderConcurrency ?? DEFAULT_GENERATION_RESOURCE_CAPACITY,
  options.imageProviderConcurrency ?? DEFAULT_GENERATION_RESOURCE_CAPACITY,
  options.videoProviderConcurrency ?? DEFAULT_GENERATION_RESOURCE_CAPACITY,
  options.musicProviderConcurrency ?? DEFAULT_GENERATION_RESOURCE_CAPACITY,
  options.ttsLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY,
  options.imageLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY,
  options.videoLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY,
  options.musicLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY
))
