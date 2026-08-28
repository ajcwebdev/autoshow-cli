import { expect } from 'bun:test'
import { fileExists } from './test-helpers'

export const requireDefined = <T>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`Missing ${label}`)
  }
  return value
}

export const expectArtifact = async (path: string, label = path): Promise<void> => {
  const exists = await fileExists(path)
  if (!exists) {
    expect.unreachable(`Missing ${label} at ${path}`)
  }
}
