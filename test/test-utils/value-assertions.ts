import { expect } from 'bun:test'
import { fileExists } from './test-helpers'

/**
 * Narrows an optional lookup and fails with the label when it is absent.
 *
 * Replaces the `if (!x) throw new Error('Missing …')` guard pattern: same message, but the
 * narrowing happens in one place and the value flows out already typed, so call sites stop
 * repeating the guard purely to satisfy the type checker.
 */
export const requireDefined = <T>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`Missing ${label}`)
  }
  return value
}

/** Asserts an artifact exists on disk, naming it in the failure. */
export const expectArtifact = async (path: string, label = path): Promise<void> => {
  const exists = await fileExists(path)
  if (!exists) {
    expect.unreachable(`Missing ${label} at ${path}`)
  }
}

/** Asserts every listed artifact exists, reporting all misses rather than only the first. */
export const expectArtifacts = async (
  paths: readonly string[],
  labelFor: (path: string) => string = (path) => path
): Promise<void> => {
  const missing: string[] = []
  for (const path of paths) {
    if (!await fileExists(path)) {
      missing.push(`${labelFor(path)} (${path})`)
    }
  }
  if (missing.length > 0) {
    expect.unreachable(`Missing artifacts:\n- ${missing.join('\n- ')}`)
  }
}
