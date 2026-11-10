import { expect, test } from 'bun:test'
import type { PipelineManifestItem } from '~/types'
import { expectedComicItemStatus } from '~/cli/commands/command-shared/pipeline-manifest/comic-metadata-status-parser'

const itemWithAudioRun = (run: Record<string, unknown>): PipelineManifestItem => {
  const notRequested = { requirement: 'not-requested', status: 'skipped', execution: { kind: 'none', reason: 'not-requested' }, targetKeys: [], artifactRefs: [] }
  return {
    input: 'scene.md', outputDir: '.', status: 'full', providers: [],
    metadata: {
      comic: {
        schemaVersion: 1,
        stages: {
          structure: { requirement: 'required', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs: [] },
          image: notRequested, audio: notRequested, presentation: notRequested,
        },
        audio: { selectedAudioRuns: [run] },
      },
    },
  }
}

const validRun = {
  targetKey: 'openai:dialogue', renderIdentity: 'a'.repeat(64), audioRunId: 'b'.repeat(64),
  audioRunRef: 'audio/audio-run.json', audioRunSha256: 'c'.repeat(64),
}

test('comic selected dialogue runs require complete identities and contained artifact paths', () => {
  expect(expectedComicItemStatus(itemWithAudioRun(validRun))).toBe('full')
  for (const key of Object.keys(validRun)) {
    const incomplete: Record<string, unknown> = { ...validRun }
    delete incomplete[key]
    expect(expectedComicItemStatus(itemWithAudioRun(incomplete))).toBeUndefined()
  }
  for (const invalid of [
    { targetKey: '' }, { renderIdentity: 'invalid' }, { audioRunId: 'invalid' },
    { audioRunRef: '../audio-run.json' }, { audioRunRef: '/audio-run.json' }, { audioRunSha256: 'invalid' },
  ]) expect(expectedComicItemStatus(itemWithAudioRun({ ...validRun, ...invalid }))).toBeUndefined()
})
