import { describe, expect, test } from 'bun:test'
import {
  ALL_STEP_CONCURRENCY_SCOPES,
  readRegisteredStepConcurrencyScopes,
  readStepConcurrencyAssignments,
  STEP_CONCURRENCY_SCOPES
} from '~/cli/flags/service-selector-normalization/step-concurrency-scopes'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import type { CliFlagOccurrence } from '~/types'

const occurrences = (...values: string[]): CliFlagOccurrence[] =>
  values.map((value) => ({ name: 'step-concurrency', raw: '--step-concurrency', value, known: true }))

const EXTRACT_SCOPES = ['stt-segment', 'stt-preflight', 'ocr-page'] as const

describe('--step-concurrency scope validation', () => {
  test('accepts a scope the command registers', () => {
    expect(readStepConcurrencyAssignments(occurrences('stt-segment=3'), EXTRACT_SCOPES).get('stt-segment')).toBe(3)
  })

  test('last assignment wins for a repeated scope', () => {
    expect(readStepConcurrencyAssignments(occurrences('stt-segment=3', 'stt-segment=9'), EXTRACT_SCOPES).get('stt-segment')).toBe(9)
  })

  test('rejects an unknown scope and names the valid ones', () => {
    expect(() => readStepConcurrencyAssignments(occurrences('bogus=3'), EXTRACT_SCOPES))
      .toThrow('Unknown --step-concurrency scope "bogus". Valid scopes here: stt-segment, stt-preflight, ocr-page.')
  })

  test('rejects a real scope that this command does not run', () => {
    expect(() => readStepConcurrencyAssignments(occurrences('tts-chunk=3'), EXTRACT_SCOPES))
      .toThrow('scope "tts-chunk" does not apply to this command. Valid scopes here: stt-segment, stt-preflight, ocr-page.')
  })

  test('rejects a missing separator and a non-positive-integer value', () => {
    expect(() => readStepConcurrencyAssignments(occurrences('stt-segment'), EXTRACT_SCOPES))
      .toThrow('is missing "="')
    expect(() => readStepConcurrencyAssignments(occurrences('stt-segment=0'), EXTRACT_SCOPES))
      .toThrow('must be a positive integer')
    expect(() => readStepConcurrencyAssignments(occurrences('stt-segment=1.5'), EXTRACT_SCOPES))
      .toThrow('must be a positive integer')
  })

  test('every registered scope set is a subset of the registry, and every scope is registered somewhere', () => {
    const claimed = new Set<string>()
    const flagSets = COMMAND_DEFINITIONS.flatMap((command) => [
      command.flags,
      ...(command.subcommands ?? []).map((subcommand) => subcommand.flags)
    ])
    for (const flags of flagSets) {
      const scopes = readRegisteredStepConcurrencyScopes(flags as never)
      if (!scopes) continue
      for (const scope of scopes) {
        expect(scope in STEP_CONCURRENCY_SCOPES).toBe(true)
        claimed.add(scope)
      }
    }

    expect([...claimed].toSorted()).toEqual([...ALL_STEP_CONCURRENCY_SCOPES].toSorted())
  })
})
