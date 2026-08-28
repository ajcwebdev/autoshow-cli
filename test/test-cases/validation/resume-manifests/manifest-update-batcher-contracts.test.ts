import { describe, expect, test } from 'bun:test'
import { createBatchedManifestUpdater, createManifest } from '~/cli/commands/process-steps/pipeline-manifest'

describe('canonical manifest update batching', () => {
  test('coalesces concurrent logical updates into one durable commit', async () => {
    let current = createManifest('tts', 'batch', [])
    let durableCommits = 0
    const updateManifest = createBatchedManifestUpdater(async (update) => {
      durableCommits += 1
      current = await update(current)
      return current
    })

    await Promise.all([0, 1, 2].map(async (index) => await updateManifest((manifest) => ({
      ...manifest,
      source: {
        ...(manifest.source ?? {}),
        [String(index)]: true
      }
    }))))

    expect(durableCommits).toBe(1)
    expect(current.source).toEqual({ 0: true, 1: true, 2: true })
  })
})
