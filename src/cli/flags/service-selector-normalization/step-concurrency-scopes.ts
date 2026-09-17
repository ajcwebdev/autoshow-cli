import { UsageError } from '~/utils/error-handler'
import {
  DEFAULT_ALL_PROVIDER_TTS_CHUNK_CONCURRENCY,
  DEFAULT_CLI_CONCURRENCY,
  DEFAULT_GROK_TTS_CHUNK_CONCURRENCY,
  DEFAULT_OCR_CONCURRENCY,
  DEFAULT_TTS_CHUNK_CONCURRENCY
} from '~/utils/concurrency-defaults'
import type { CliFlagOccurrence } from '~/types'

// Single source of truth for `--step-concurrency <scope>=N`. Intra-step parallelism used to be five
// separate flags; the scopes below are the same knobs, named once, with their defaults imported from
// the concurrency constants rather than restated.
export type StepConcurrencyScopeDefinition = Readonly<{
  description: string
  /** The static default. `'auto'` means the step chooses per run and there is no fixed number. */
  defaultValue: number | 'auto'
  /** Recorded when the effective value legitimately depends on the selection, never hidden. */
  dynamicDefaultNote?: string
}>

export const STEP_CONCURRENCY_SCOPES = {
  'stt-segment': {
    description: 'Split segments in flight per STT provider; local providers clamp to one.',
    defaultValue: DEFAULT_CLI_CONCURRENCY
  },
  'stt-preflight': {
    description: 'Duration probes running in parallel during STT preflight.',
    defaultValue: DEFAULT_CLI_CONCURRENCY
  },
  'ocr-page': {
    description: 'Page requests per OCR provider. An explicit value is a hard cap for hosted OCR.',
    defaultValue: 'auto',
    dynamicDefaultNote: `local OCR uses ${DEFAULT_OCR_CONCURRENCY}; hosted OCR chooses per run unless this scope is assigned`
  },
  'tts-chunk': {
    description: 'Hosted TTS chunk starts per provider across the run, including multiple items.',
    defaultValue: DEFAULT_TTS_CHUNK_CONCURRENCY,
    dynamicDefaultNote: `${DEFAULT_ALL_PROVIDER_TTS_CHUNK_CONCURRENCY} under --all-providers and ${DEFAULT_GROK_TTS_CHUNK_CONCURRENCY} for a Grok-only selection, unless this scope is assigned`
  },
  sfx: {
    description: 'Bounded parallel sound-effect requests.',
    defaultValue: 2
  }
} as const satisfies Record<string, StepConcurrencyScopeDefinition>

export type StepConcurrencyScope = keyof typeof STEP_CONCURRENCY_SCOPES

export const ALL_STEP_CONCURRENCY_SCOPES = Object.keys(STEP_CONCURRENCY_SCOPES) as StepConcurrencyScope[]

export const STEP_CONCURRENCY_FLAG = 'step-concurrency'

export const stepConcurrencyDefaultFor = (scope: StepConcurrencyScope): string =>
  String(STEP_CONCURRENCY_SCOPES[scope].defaultValue)

/** The rendered `default`, per the scoped-repeatable convention: display only, never resolved from. */
export const stepConcurrencyDefaults = (scopes: readonly StepConcurrencyScope[]): string[] =>
  scopes.map((scope) => `${scope}=${stepConcurrencyDefaultFor(scope)}`)

// Scope applicability is a per-command fact, so the flag definition carries its command's scopes and
// the dispatcher validates every occurrence against them once, before any resolver runs.
export const STEP_CONCURRENCY_SCOPES_HELP_KEY = 'stepConcurrencyScopes'

export const readRegisteredStepConcurrencyScopes = (
  flags: Record<string, { help?: Record<string, unknown> | undefined } | undefined> | undefined
): StepConcurrencyScope[] | undefined => {
  const declared = flags?.[STEP_CONCURRENCY_FLAG]?.help?.[STEP_CONCURRENCY_SCOPES_HELP_KEY]
  return Array.isArray(declared) ? declared as StepConcurrencyScope[] : undefined
}

export const stepConcurrencyDescription = (scopes: readonly StepConcurrencyScope[]): string => {
  const rows = scopes.map((scope) => {
    const definition: StepConcurrencyScopeDefinition = STEP_CONCURRENCY_SCOPES[scope]
    const note = definition.dynamicDefaultNote ? ` (${definition.dynamicDefaultNote})` : ''
    return `${scope}: ${definition.description}${note}`
  })
  return `Intra-step parallelism as <scope>=N; repeatable, last assignment wins. Scopes — ${rows.join(' ')}`
}

const invalidScope = (scope: string, scopes: readonly StepConcurrencyScope[]): Error =>
  UsageError(`Unknown --${STEP_CONCURRENCY_FLAG} scope "${scope}". Valid scopes here: ${scopes.join(', ')}.`)

/**
 * Reads explicit occurrences only. The seeded `default` array exists so `--help` can show the
 * per-scope defaults; resolution falls back to the registry for any scope left unassigned, so the
 * displayed default and the effective default come from the same constant.
 */
export const readStepConcurrencyAssignments = (
  flagOccurrences: readonly CliFlagOccurrence[],
  scopes: readonly StepConcurrencyScope[]
): Map<StepConcurrencyScope, number> => {
  const assignments = new Map<StepConcurrencyScope, number>()
  for (const occurrence of flagOccurrences) {
    if (occurrence.name !== STEP_CONCURRENCY_FLAG) continue
    if (typeof occurrence.value !== 'string') {
      throw UsageError(`--${STEP_CONCURRENCY_FLAG} requires <scope>=N, for example ${scopes[0] ?? 'stt-segment'}=4.`)
    }
    const separator = occurrence.value.indexOf('=')
    if (separator <= 0) {
      throw UsageError(`--${STEP_CONCURRENCY_FLAG} "${occurrence.value}" is missing "=". Use <scope>=N, for example ${scopes[0] ?? 'stt-segment'}=4.`)
    }
    const scope = occurrence.value.slice(0, separator).trim()
    const rawValue = occurrence.value.slice(separator + 1).trim()
    if (!(scope in STEP_CONCURRENCY_SCOPES)) throw invalidScope(scope, scopes)
    if (!scopes.includes(scope as StepConcurrencyScope)) {
      throw UsageError(`--${STEP_CONCURRENCY_FLAG} scope "${scope}" does not apply to this command. Valid scopes here: ${scopes.join(', ')}.`)
    }
    const value = Number(rawValue)
    if (!Number.isInteger(value) || value < 1) {
      throw UsageError(`--${STEP_CONCURRENCY_FLAG} ${scope} must be a positive integer, not "${rawValue}".`)
    }
    assignments.set(scope as StepConcurrencyScope, value)
  }
  return assignments
}

export const readStepConcurrency = (
  flagOccurrences: readonly CliFlagOccurrence[],
  scopes: readonly StepConcurrencyScope[],
  scope: StepConcurrencyScope
): number | undefined => readStepConcurrencyAssignments(flagOccurrences, scopes).get(scope)

const parseConfiguredAssignments = (
  value: unknown,
  scopes: readonly StepConcurrencyScope[]
): Map<StepConcurrencyScope, number> => {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  return readStepConcurrencyAssignments(
    entries.flatMap((entry) => typeof entry === 'string' ? [{ name: STEP_CONCURRENCY_FLAG, raw: entry, value: entry, known: true }] : []),
    scopes
  )
}

/**
 * Resolution order: an explicit occurrence, then a config-injected assignment, then the registry
 * default. The seeded `default` array is never read, so a config that assigns one scope cannot erase
 * the defaults of the others.
 */
export const resolveStepConcurrency = (
  scope: StepConcurrencyScope,
  scopes: readonly StepConcurrencyScope[],
  flagOccurrences: readonly CliFlagOccurrence[],
  flags: Record<string, unknown> = {},
  configuredFlags: ReadonlySet<string> = new Set()
): { value: number | undefined, assigned: boolean } => {
  const explicit = readStepConcurrencyAssignments(flagOccurrences, scopes).get(scope)
  if (explicit !== undefined) return { value: explicit, assigned: true }

  if (configuredFlags.has(STEP_CONCURRENCY_FLAG)) {
    const configured = parseConfiguredAssignments(flags[STEP_CONCURRENCY_FLAG], scopes).get(scope)
    if (configured !== undefined) return { value: configured, assigned: true }
  }

  const fallback = STEP_CONCURRENCY_SCOPES[scope].defaultValue
  return { value: fallback === 'auto' ? undefined : fallback, assigned: false }
}
