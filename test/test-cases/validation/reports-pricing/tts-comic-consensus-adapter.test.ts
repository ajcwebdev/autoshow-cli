import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTtsManifestRecord } from '../../../../.codex/skills/consensus/scripts/tts/tts_eval_lib'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('TTS comic consensus adapter', () => {
  test('loads in-place comic audio outputs and selected render cost', async () => {
    const runDir = await mkdtemp(join(tmpdir(), 'autoshow-tts-comic-consensus-'))
    roots.push(runDir)
    const artifactDir = 'audio/providers/hume-octave-1'
    await mkdir(join(runDir, artifactDir), { recursive: true })
    await writeFile(join(runDir, artifactDir, 'provider-render-result.json'), JSON.stringify({
      cost: {
        currentComposition: {
          planned: { amounts: [{ amount: 0.123, currency: 'USD' }] },
          observed: [],
        },
      },
    }))
    const projection = {
      selectedSuccess: { renderIdentity: 'render-1', eventSequence: 1, resultIdentity: 'result-1', audioRunId: 'audio-1' },
      renderHistory: [{ renderIdentity: 'render-1', events: [{ sequence: 1, providerRenderResultRef: 'provider-render-result.json' }] }],
    }
    await writeFile(join(runDir, 'manifest.json'), JSON.stringify({
      command: 'comic', scope: 'single', createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:01:00.000Z', source: {},
      items: [{
        status: 'full', metadata: { tts: [{ ttsService: 'hume', ttsModel: 'octave-1', processingTime: 1234, audioFileName: 'audio/final/hume_octave-1.wav', audioFileSize: 456, chunkCount: 51 }] },
        providers: [{ service: 'hume', model: 'octave-1', artifactDir, status: 'succeeded', attempts: 1, options: {}, metadata: { comicAudio: projection }, result: { comicAudio: projection } }],
      }],
    }))

    const record = loadTtsManifestRecord(runDir)
    expect(record.metadata.tts).toEqual([expect.objectContaining({ ttsService: 'hume', ttsModel: 'octave-1', chunkCount: 51 })])
    expect(record.metadata.cost?.actual?.steps).toEqual([{ provider: 'hume', model: 'octave-1', cost: 12.3 }])
  })
})
